const validator = require('validator');

console.log('Verifying fix configuration:');
const options = { protocols: ['http', 'https'], require_tld: false, require_protocol: true };

console.log('localhost:', validator.isURL('http://localhost:8080/playlist.m3u8', options));
console.log('127.0.0.1:', validator.isURL('http://127.0.0.1:8080/playlist.m3u8', options));
console.log('example.com:', validator.isURL('http://example.com/playlist.m3u8', options));
console.log('no protocol (should fail):', validator.isURL('localhost:8080/playlist.m3u8', options));
