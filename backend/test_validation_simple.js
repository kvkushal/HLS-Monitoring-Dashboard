const validator = require('validator');

console.log('Direct validator test:');
console.log('localhost default:', validator.isURL('http://localhost:8080/playlist.m3u8', { protocols: ['http', 'https'] }));
console.log('127.0.0.1 default:', validator.isURL('http://127.0.0.1:8080/playlist.m3u8', { protocols: ['http', 'https'] }));
console.log('localhost (require_tld: false):', validator.isURL('http://localhost:8080/playlist.m3u8', { protocols: ['http', 'https'], require_tld: false }));
