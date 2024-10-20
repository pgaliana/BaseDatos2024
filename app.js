const express = require('express');
const sqlite3 = require('sqlite3');
const ejs = require('ejs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static('views'));


// Ruta alternativa para la base de datos movies.db (No me funcionaba la forma anterior)
const dbPath = path.join(__dirname, 'movies (3).db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al abrir la base de datos:', err.message);
    } else {
        console.log('Conexión establecida a la base de datos.');
    }
});


// Configurar el motor de plantillas EJS
app.set('view engine', 'ejs');

// Ruta para la página de inicio
app.get('/', (req, res) => {
    res.render('index');
});

// Ruta para buscar películas
app.get('/buscar', (req, res) => {
    	const searchTerm = req.query.q;
	const searchTermLike = `%${searchTerm}%`;
	// Realizar la búsqueda en la base de datos
    	db.all(
        	'SELECT * FROM movie WHERE title LIKE ?',
        	[searchTermLike],
        	(errMovies, movies) => {
            	if (errMovies) {
                	console.error(errMovies);
                	return res.status(500).send('Error en la búsqueda.');
            	}
		//Ruta para buscar actores
		db.all(
			'SELECT person_name FROM person JOIN movie_cast ON person.person_id = movie_cast.person_id WHERE upper(person_name) LIKE upper(?) GROUP BY person.person_id, person_name',
			[searchTermLike],
        		(errActors, actors) => {
            			if (errActors) {
                			console.error(errActors);
                			return res.status(500).send('Error en la búsqueda.');
            		}
			//Ruta para buscar directores
        		db.all(
                	'SELECT person_name FROM person JOIN movie_crew ON person.person_id = movie_crew.person_id WHERE movie_crew.job = \'Director\' AND upper(person_name) LIKE upper(?) GROUP BY person.person_id, person_name',
                	[searchTermLike],
                	(errDirector, directors) => {
                        	if (errDirector) {
                                	console.error(errDirector);
                                	return res.status(500).send('Error en la búsqueda.');
                        	}
				res.render('resultado', {movies, actors, directors});
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

// Ruta para mostrar la página de un actor específico
app.get('/actor/:id', (req, res) => {
    const actorId = req.params.id;
	const query = 'SELECT movie.title, movie.release_date, person.person_name FROM person JOIN movie_cast ON person.person_id = movie_cast.person_id JOIN movie ON movie_cast.movie_id = movie.movie_id WHERE person.person_id = ? ORDER BY movie.release_date DESC'
;
    // Ejecutar la consulta
    db.all(query, [actorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del actor.');
        }else {
            const actorName = movies[0].person_name;
            res.render('actor', { actorName, movies });
        }
    });
});

// Ruta para mostrar la página de un director específico
app.get('/director/:id', (req, res) => {
    const directorId = req.params.id;

    // Consulta SQL para obtener las películas dirigidas por el director
    const query =
	'SELECT DISTINCT movie.title, movie.release_date, person.person_name FROM person JOIN movie_crew ON person.person_id = movie_crew.person_id JOIN movie ON movie.movie_id = movie_crew.movie_id WHERE person.person_id = ? ORDER BY movie.release_date DESC';

    // Ejecutar la consulta
    db.all(query, [directorId], (err, movies) => {
        if (err) {
            console.error(err);
            res.status(500).send('Error al cargar las películas del director.');
        }else {
            // Obtener el nombre del director del primer resultado
            const directorName = movies[0].person_name;
	    // Organizar los datos en un objeto de película con año
            const movieData = {
                id: movies[0].movie_id,
                title: movies[0].title,
                release_date: movies[0].release_date,
		movies: []
		}
	    movies.forEach(row => {
		movieData.movies.push({
		title: row.title,
		release_date: row.release_date
		});
	});
            res.render('director', { directorName, movies:movieData });
        }
    });
});
// Iniciar el servidor
app.listen(port, () => {
    console.log(`Servidor en ejecución en http://localhost:${port}`);
});
