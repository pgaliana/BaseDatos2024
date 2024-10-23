const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));
app.use(cookieParser());

// Path completo de la base de datos movies.db
// Por ejemplo 'C:\\Users\\datagrip\\movies.db'
const db = new sqlite3.Database('./movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para el inicio de sesion
app.get('/login', (req, res) => {
    const user_name = req.query.uName;
    const user_password = req.query.uPassword;

    if (user_name !== undefined  && user_password !== undefined) {
        const userQuery = 'SELECT * FROM User WHERE user_name = ? AND user_password = ?';
        db.all(
            userQuery,
            [user_name, user_password],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error en la búsqueda.');
                } else {
                    if (result.length > 0) {
                        res.cookie('user_id', result[0]["user_id"]);
                        res.redirect('./index');
                    } else {
                        res.render('login');
                    }
                }
            }
        )
    } else {
        res.render('login');
    }
});

// Ruta para registrarse
app.get('/signUp', (req, res) => {
    const userName = req.query.uName;
    const userPassword = req.query.uPassword;
    const userEmail = req.query.uEmail;

    const signUpQuery = 'INSERT INTO User(user_name, user_password, user_email, user_super) VALUES (?,?,?, 0)'
    db.all(
        signUpQuery,
        [userName, userPassword, userEmail],
        (err, result) => {
            if (userName !== undefined  && userPassword !== undefined) {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error en el registro.');
                } else{
                    res.redirect('signUpExitoso');
                }
            } else {
                res.render('signUp');
            }
        }
    )
})

// Ruta para el sign up exitoso
app.get('/signUpExitoso', (req, res) => {
    res.render('signUpExitoso');
})

// Ruta para buscador
app.get('/index', (req, res) => {
    res.render('index');
})

// Ruta para cuenta
app.get('/user', (req, res) => {
    const userId = req.cookies['user_id'];

    const userDataQuery = 'SELECT * FROM User WHERE user_id = ?';
    db.all(userDataQuery, [userId],(err, result) => {
        if (err) {
            console.log(err);
            res.status(500).send('Error en la busqueda.');
        } else{
            res.render('user/user', {user_name: result[0]['user_name'], user_email: result[0]['user_email']});
        }
    })
})

// Ruta para modificar un usuario
app.get('/modifyUser', (req, res) => {
    const userId = req.cookies['user_id']
    const userName = req.query.userName
    const userPassword = req.query.userPassword
    const userEmail = req.query.userEmail
    if (userName !== undefined && userEmail !== undefined){
        const userUpdateQuery = 'UPDATE User SET user_name = ?, user_password = ?,user_email = ? WHERE user_id = ?'
        db.all(userUpdateQuery, [userName, userPassword, userEmail, userId], (err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error en la update.');
            } else{
                res.redirect(`/login`);
            }
        })
    } else {
        const userDataQuery = 'SELECT * FROM User WHERE user_id = ?'
        db.all(
            userDataQuery,
            [userId],
         (err, result) => {
                res.render('user/modifyUser', {user_name: result[0]['user_name'], user_password: result[0]['user_password'], user_email: result[0]['user_email']});
         }
        )
    }
})

// Ruta para eliminar un usuario
app.get('/deleteUser', (req, res) => {
    const userId = req.query.userId;
    var user = {}

    if (userId !== undefined) {
        const userDeleteQuery = 'DELETE FROM User WHERE user_id = ?';
        db.all(
            userDeleteQuery,
            [req.cookies['user_id']],
            (err, result) => {
                if (err) {
                    console.log(err);
                    res.status(500).send('Error en la busqueda.');
                } else{
                    res.redirect('/login')
                }
            }
        )
    } else {
        const userDataQuery = 'SELECT * FROM User WHERE user_id = ?';
        db.all(userDataQuery, [req.cookies.user_id],(err, result) => {
            if (err) {
                console.log(err);
                res.status(500).send('Error en la busqueda.');
            } else{
                user = result[0];
                res.render('user/deleteUser', {user_name: user['user_name'], user_id: user['user_id']});
            }
        })
    }
})

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;

    // Realizar la búsqueda en la base de datos
    db.all(
        'SELECT * FROM movie WHERE title LIKE ?',
        [`%${searchTerm}%`],
        (err, movieList) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            }
            //Ruta para buscar actores
            db.all(
                'SELECT person.person_id as id, person_name FROM person JOIN movie_cast ON person.person_id = movie_cast.person_id WHERE upper(person_name) LIKE upper(?) GROUP BY person.person_id, person_name',
                [`%${searchTerm}%`],
                (err, actorList) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Error en la búsqueda.');
                    }
                    //Ruta para directores
                    db.all(
                        'SELECT person.person_id as id, person_name FROM person JOIN movie_crew ON person.person_id = movie_crew.person_id WHERE movie_crew.job = \'Director\' AND person_name LIKE ? GROUP BY person.person_id, person_name',
                        [`%${searchTerm}%`],
                        (err, directorList) => {
                            if (err) {
                                console.error(err);
                                res.status(500).send('Error en la búsqueda.');
                            }
                            res.render('resultado', {movies: movieList, actor: actorList, directors: directorList});
                        }
                    );
                }
            );
        }
    );
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
    WHERE movie.movie_id = ?
  `;

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else if (rows.length === 0) {
            res.status(404).send('Película no encontrada.');
        } else {
            // Organizar los datos en un objeto de película con elenco y crew
            const movieData = {
                id: rows[0].id,
                title: rows[0].title,
                release_date: rows[0].release_date,
                overview: rows[0].overview,
                directors: [],
                writers: [],
                cast: [],
                crew: [],
            };

            // Crear un objeto para almacenar directores
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en directors
                    const isDuplicate = movieData.directors.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de directors
                        if (row.department_name === 'Directing' && row.job === 'Director') {
                            movieData.directors.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar writers
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en writers
                    const isDuplicate = movieData.writers.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de writers
                        if (row.department_name === 'Writing' && row.job === 'Writer') {
                            movieData.writers.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            // Crear un objeto para almacenar el elenco
            rows.forEach((row) => {
                if (row.actor_id && row.actor_name && row.character_name) {
                    // Verificar si ya existe una entrada con los mismos valores en el elenco
                    const isDuplicate = movieData.cast.some((actor) =>
                        actor.actor_id === row.actor_id
                    );

                    if (!isDuplicate) {
                    // Si no existe, agregar los datos a la lista de elenco
                        movieData.cast.push({
                            actor_id: row.actor_id,
                            actor_name: row.actor_name,
                            character_name: row.character_name,
                            cast_order: row.cast_order,
                        });
                    }
                }
            });

            // Crear un objeto para almacenar el crew
            rows.forEach((row) => {
                if (row.crew_member_id && row.crew_member_name && row.department_name && row.job) {
                    // Verificar si ya existe una entrada con los mismos valores en el crew
                    const isDuplicate = movieData.crew.some((crew_member) =>
                        crew_member.crew_member_id === row.crew_member_id
                    );

                    // console.log('movieData.crew: ', movieData.crew)
                    // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
                    if (!isDuplicate) {
                        // Si no existe, agregar los datos a la lista de crew
                        if (row.department_name !== 'Directing' && row.job !== 'Director'
                        && row.department_name !== 'Writing' && row.job !== 'Writer') {
                            movieData.crew.push({
                                crew_member_id: row.crew_member_id,
                                crew_member_name: row.crew_member_name,
                                department_name: row.department_name,
                                job: row.job,
                            });
                        }
                    }
                }
            });

            res.render('pelicula', { movie: movieData });
        }
    });
});

// Ruta para mostrar la página de una persona específica
app.get('/persona/:id', (req, res) => {
    const personId = req.params.id;

    // Consulta SQL para obtener las películas en donde actúa la persona
    const actorQuery = `
    SELECT DISTINCT person.person_name as personName, movie_cast.character_name as characterName, movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE person.person_id = ?;
    `
    // Consulta SQL para obtener las películas dirigidas por la persona
    const directorQuery = `
    SELECT person.person_name as personName, movie.*
    FROM movie
    INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    INNER JOIN person ON person.person_id = movie_crew.person_id
    WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
  `;

    // Ejecutar la consulta
    db.all(actorQuery, [personId], (err, isActor) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            }
            db.all(directorQuery, [personId], (err, isDirector) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Error en la búsqueda.');
                    }
                    const personName = isActor.length > 0 ? isActor[0].personName : '';
                    res.render('persona', {personName, isActor, isDirector});
                }
            );
        }
    );
});

// Pagina Keywords
app.get('/keyword', (req, res) => {
    res.render('keywords/keywordSearcher');
})

// Busqueda de Keywords
app.get('/buscar-keyword/', (req, res) => {
    const keyword = req.query.q
    const keywordSearchQuery =
        `WITH keyword_nameMovie_id AS(
        SELECT keyword_name, movie_id FROM keyword JOIN movie_keywords ON keyword.keyword_id = movie_keywords.keyword_id
        )
        SELECT title, keyword_name FROM movie JOIN keyword_nameMovie_id on movie.movie_id = keyword_nameMovie_id.movie_id
        WHERE keyword_name = ?
        `
    db.all(
        keywordSearchQuery,
        [keyword],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            } else {
                res.render('keywords/result_keywords', { movies: rows });
            }
        }
    );
})

// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}/login`);
});
