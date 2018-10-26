const express = require('express');
const cons = require('consolidate');
const app = express();

app.engine('dust', cons.dust);
app.set('view engine', 'dust');
app.set("views", __dirname + "/../public/templates/");

module.exports = app;