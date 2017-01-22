/**
 * scripts/main.js
 *
 * This is the starting point for your application.
 * Take a look at http://browserify.org/ for more info
 */

'use strict';

var App = require('./app.js');

var app = new App();

app.beep();

var MarkovChain = require('markovchain');

document.getElementById('generate').addEventListener('click', function() {
    var input = document.getElementById('input');
    var m = new MarkovChain(input.value);
    var output = m.process();
    document.getElementById('output').value = output;
});