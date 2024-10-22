const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));

// Path completo de la base de datos movies.db
// Por ejemplo 'C:\\Users\\datagrip\\movies.db'
const db = new sqlite3.Database('./movies.db');

// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    const searchTerm = req.query.q;
    // Realizar la búsqueda en la base de datos
    db.all(
        'SELECT * FROM movie WHERE title LIKE ?',
        [`%${searchTerm}%`],
        (err, Garro) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            }
            // Ruta para buscar actores
            db.all(
                'SELECT person.person_id as id, person_name FROM person JOIN movie_cast ON person.person_id = movie_cast.person_id WHERE upper(person_name) LIKE upper(?) GROUP BY person.person_id, person_name',
                [`%${searchTerm}%`],
                (err, Churro) => {
                    if (err) {
                        console.error(err);
                        res.status(500).send('Error en la búsqueda.');
                    }
                    // Ruta para directores
                    db.all(
                        'SELECT person.person_id as id, person_name FROM person JOIN movie_crew ON person.person_id = movie_crew.person_id WHERE movie_crew.job = \'Director\' AND person_name LIKE ? GROUP BY person.person_id, person_name',
                        [`%${searchTerm}%`],
                        (err, Bang) => {
                            if (err) {
                                console.error(err);
                                res.status(500).send('Error en la búsqueda.');
                            }
                            res.render('resultado', { movies: Garro, actor: Churro, directors: Bang });
                        }
                    );
                }
            );
        }
    );
});

// Ruta para buscar películas por sus palabras claves
app.get('/buscar2', (req, res) => {
    const searchTerm = req.query.q;
    db.all(
        'SELECT title FROM movie JOIN movie_keywords K on movie.movie_id = K.movie_id JOIN keyword kk on kk.keyword_id = K.keyword_id WHERE keyword_id LIKE ?',
        [`%${searchTerm}%`],
        (err, rows) => {
            if (err) {
                console.error(err);
                res.status(500).send('Error en la búsqueda.');
            }
            res.render('resultado', { movies: rows });
        }
    );
});

// Ruta para la página de datos de una película particular
app.get('/pelicula/:id', (req, res) => {
    const movieId = req.params.id;

    // Consulta SQL para obtener los datos de la película, elenco y crew
    const query = `
        SELECT m.*, 
        GROUP_CONCAT(DISTINCT g.genre_name) AS genre, 
        GROUP_CONCAT(DISTINCT k.keyword_name) AS keyword, 
        GROUP_CONCAT(DISTINCT l.language_name) AS language, 
        GROUP_CONCAT(DISTINCT p.company_name) AS production_company, 
        GROUP_CONCAT(DISTINCT c.country_name) AS production_country, 
        GROUP_CONCAT(DISTINCT pers.person_name) AS cast_members, 
        GROUP_CONCAT(DISTINCT pers2.person_name) AS crew_members, 
        GROUP_CONCAT(DISTINCT pers3.person_name) AS directors 
        FROM movie m 
        LEFT JOIN movie_genres mg ON m.movie_id = mg.movie_id 
        LEFT JOIN genre g ON mg.genre_id = g.genre_id 
        LEFT JOIN movie_keywords mk ON m.movie_id = mk.movie_id 
        LEFT JOIN keyword k ON mk.keyword_id = k.keyword_id 
        LEFT JOIN movie_languages ml ON m.movie_id = ml.movie_id 
        LEFT JOIN language l ON ml.language_id = l.language_id 
        LEFT JOIN movie_company mc ON m.movie_id = mc.movie_id 
        LEFT JOIN production_company p ON mc.company_id = p.company_id 
        LEFT JOIN production_country pc ON m.movie_id = pc.movie_id 
        LEFT JOIN country c ON pc.country_id = c.country_id 
        LEFT JOIN movie_cast mc2 ON m.movie_id = mc2.movie_id 
        LEFT JOIN person pers ON mc2.person_id = pers.person_id  
        LEFT JOIN movie_crew mc3 ON m.movie_id = mc3.movie_id  
        LEFT JOIN person pers2 ON mc3.person_id = pers2.person_id  
        LEFT JOIN movie_crew mc4 ON m.movie_id = mc4.movie_id AND mc4.job = 'Director'  
        LEFT JOIN person pers3 ON mc4.person_id = pers3.person_id 
        WHERE m.movie_id = ?  
        GROUP BY m.movie_id;
    `;

    // Ejecutar la consulta
    db.all(query, [movieId], (err, rows) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar los datos de la película.');
        } else {
            res.render('pelicula', { movie: rows[0] });
        }
    });
});

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;

    // Consulta SQL para obtener las películas en las que participó el actor
    const query = `
        SELECT DISTINCT
        person.person_name as actorName,
        movie.*
        FROM movie
        INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
        INNER JOIN person ON person.person_id = movie_cast.person_id
        WHERE movie_cast.person_id = ?;
    `;

    // Ejecutar la consulta
    db.all(query, [actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        } else {
            // Obtener el nombre del actor
            const actorName = movies.length > 0 ? movies[0].actorName : '';

            res.render('actor', { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query = `
        SELECT DISTINCT
        person.person_name as directorName,
        movie.*
        FROM movie
        INNER JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
        INNER JOIN person ON person.person_id = movie_crew.person_id
        WHERE movie_crew.job = 'Director' AND movie_crew.person_id = ?;
    `;

    // Ejecutar la consulta
    db.all(query, [directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        } else {
            // Obtener el nombre del director
            const directorName = movies.length > 0 ? movies[0].directorName : '';
            res.render('director', { directorName, movies });
        }
    });
});

// Iniciar el servidor
app.listen(port, () => {
    console.log(`UWU http://localhost:${port}`);
});
