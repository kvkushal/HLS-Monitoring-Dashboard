const { body, validationResult } = require('express-validator');
const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());

const validateStream = [
    body('url')
        .isURL({ protocols: ['http', 'https'] })
        .withMessage('Invalid URL format')
];

app.post('/test', validateStream, (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    res.status(200).send('OK');
});

async function runTest() {
    console.log("Testing http://localhost:8080/playlist.m3u8");
    await request(app)
        .post('/test')
        .send({ url: 'http://localhost:8080/playlist.m3u8' })
        .expect(400)
        .then(res => console.log('Localhost Result:', JSON.stringify(res.body)));

    console.log("Testing http://example.com/playlist.m3u8");
    await request(app)
        .post('/test')
        .send({ url: 'http://example.com/playlist.m3u8' })
        .expect(200)
        .then(res => console.log('Example.com Result:', res.status));
}

// Mock supertest simply by running express logic if supertest is not available, 
// strictly we'd need to install it, but I can just use the validator directly.
const validator = require('validator');
console.log('Direct validator test:');
console.log('localhost:', validator.isURL('http://localhost:8080/playlist.m3u8', { protocols: ['http', 'https'] }));
console.log('127.0.0.1:', validator.isURL('http://127.0.0.1:8080/playlist.m3u8', { protocols: ['http', 'https'] }));
console.log('example.com:', validator.isURL('http://example.com/playlist.m3u8', { protocols: ['http', 'https'] }));

// Also check if require_tld defaults to true
console.log('localhost (require_tld: false):', validator.isURL('http://localhost:8080/playlist.m3u8', { protocols: ['http', 'https'], require_tld: false }));
