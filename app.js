const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');
const app = express();
const port = 3000;

require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_DATABASE,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    ssl: { rejectUnauthorized: false }
});

app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: app.get('env') === 'production' }
}));

app.use((req, res, next) => {
    if (req.session.user) {
        req.user = req.session.user;
        next();
    } else {
        next();
    }
});

let enableSqlInjection = false;
let enableBrokenAccessControl = false;

app.get('/', (req, res) => {
    const loggedInUser = req.session.user ? req.session.user.username : 'not logged in yet';
    res.render('index', {
        enableSqlInjection: enableSqlInjection,
        enableBrokenAccessControl: enableBrokenAccessControl,
        loggedInUser: loggedInUser 
    });
});


app.post('/login', (req, res) => {
    const { username, password } = req.body;
    let query;

    if (enableSqlInjection) {
        query = `SELECT * FROM public.users WHERE username = '${username}' AND password = '${password}'`;
        pool.query(query, (err, results) => { 
            if (err) {
                return res.status(500).send('Error executing query: ' + err.message);
            }
            if (results.rowCount > 0) {
                req.session.user = { username: username, role: results.rows[0].role };
                res.send('Logged in successfully');
            } else {
                res.send('Login failed');
            }
        });
    } else {
        query = 'SELECT * FROM public.users WHERE username = $1 AND password = $2';
        pool.query(query, [username, password], (err, results) => {
            if (err) {
                return res.status(500).send('Error executing query: ' + err.message);
            }
            if (results.rowCount > 0) {
                req.session.user = { username: username, role: results.rows[0].role };
                res.send('Logged in successfully');
            } else {
                res.send('Login failed');
            }
        });
    }
});


app.post('/toggle-sql-injection', (req, res) => {
    enableSqlInjection = !enableSqlInjection;
    res.redirect('/');
});

app.post('/toggle-access-control', (req, res) => {
    enableBrokenAccessControl = !enableBrokenAccessControl;
    res.redirect('/');
});

app.get('/admin', (req, res) => {
    if (enableBrokenAccessControl) {
        res.send('Admin page content here, you have access to sensitive data of every user');
    } else {
        if (req.user && req.user.role === 'admin') {
            res.send('Admin page content here, you have access to sensitive data of every user');
        } else {
            res.status(403).send('Access Denied');
        }
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
