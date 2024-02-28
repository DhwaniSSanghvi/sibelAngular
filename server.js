// const express = require('express');
// const path = require('path');
// const app = express();
// const port = 5000; // You can change this to the desired port number\
// const http = require('http');
// const SerialPort = require('serialport');
// const cors = require('cors');
// const https = require('https');
// const fs = require('fs');

// app.use(cors());

// const options = {
//   key: fs.readFileSync('server.key'),
//   cert: fs.readFileSync('server.crt')
// };


// // to create server for getting ports
//   app.get('/serialports', (req, res) => {
//     let portsarray = [];
//     SerialPort.SerialPort.list().then((ports) => {
//         ports.forEach(element => {
//             portsarray.push(element.path.split("/dev/").pop())
//           });
//           res.json(portsarray);
//     }).catch((err) => {
//       res.status(500).send('Error fetching serial ports: ' + err.message);
//     });
//   });

//   https.createServer(app).listen(443, () => {
//     console.log('Server running on https://localhost:443');
//   });

// // Serve static files (HTML, CSS, JavaScript, etc.)
// app.use(express.static(path.join(__dirname, '/')));

// // Define a route for the root URL
// app.get('/', (req, res) => {
//     res.sendFile(path.join(__dirname, 'index.html'));
// });

// // Start the server
// app.listen(port, () => {
//     console.log(`Server is running on http://localhost:${port}`);
// });


const https = require('https');
const fs = require('fs');
const express = require('express');
const SerialPort = require('serialport');
const cors = require('cors');
const path = require('path');
const port = 5000;



const app = express();
app.use(cors());

app.get('/serialports', (req, res) => {
  let portsarray =[];
  SerialPort.SerialPort.list().then((ports) => {
            ports.forEach(element => {
                portsarray.push(element.path.split("/dev/").pop())
              });
              res.json(portsarray);
        }).catch((err) => {
          res.status(500).send('Error fetching serial ports: ' + err.message);
        });
});


// Serve static files (HTML, CSS, JavaScript, etc.)
app.use(express.static(path.join(__dirname, '/')));

// Define a route for the root URL
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// // Start the server
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
