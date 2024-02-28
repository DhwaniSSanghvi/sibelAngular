//Global data
const websiteVersion = "0.0.5";
const GraphResolveTime = 5;
const DataResolveTime = 10;
const timeDiff = 16;    //4096/256
const timeDiffppg = 64; //4096/64

let glowStatus = false;
let intervalId;
let evtname = "";
let writeFlag = false;
let dataReadFlag = true;
let chestDisconnPress = false;
let limbDisconnPress = false;
let chestTimeoutId = "";
let limbTimeoutId = "";

class DataQueue {
  constructor() {
    this.queue = [];
  }

  enqueue(data) {
    this.queue.push(data);
  }

  dequeue() {
    return this.queue.shift();
  }

  isEmpty() {
    return this.queue.length === 0;
  }
}
//Defining seperate queues for every data parameter
const TemperatureQueue = new DataQueue();
const ECGQueue = new DataQueue();
const PPGIRQueue = new DataQueue();
const PPGREDQueue = new DataQueue();
const RawQueue = new DataQueue();
const cstdatFileQueue = new DataQueue();
const limdatFileQueue = new DataQueue();
const cstwvfFileQueue = new DataQueue();
const limwvfFileQueue = new DataQueue();
const coreDataQueue = new DataQueue();
const dataQueue = new DataQueue();

const plotting = {
  tmp: {
    characteristics: "slow",
    queueName: TemperatureQueue,
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "Temperature (in °C)",
    type: "scatter",
    mode: "markers",
    maxDataPoints: 20,
    cssName: "Temperature",
    heading: "Temperature Data",
    trace: {
      0: {
        x: [],
        y: [],
        marker: {
          color: "red", // Specify the color of the markers
        },
        type: "scatter",
        mode: "markers",
        name: "ANNE Chest",
      },

      1: {
        x: [],
        y: [],
        marker: {
          color: "blue", // Specify the color of the markers
        },
        type: "scatter",
        mode: "markers",
        name: "ANNE Limb",
      },
    },
  },
  hr_: {
    characteristics: "slow",
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "BPM",
    maxDataPoints: 20,
    cssName: "HR",
    heading: "Heart Rate Data",
    trace: {
      0: {
        x: [],
        y: [],

        marker: {
          color: "red", // Specify the color of the markers
        },
        type: "scatter",
        mode: "markers",
      },
    },
  },
  sp2: {
    characteristics: "slow",
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "spO2",
    maxDataPoints: 20,
    cssName: "SP2",
    heading: "spO2",
    trace: {
      0: {
        x: [],
        y: [],
        marker: {
          marker: {
            color: "blue", // Specify the color of the markers
          }, // Specify the color of the markers
        },
        type: "scatter",
        mode: "markers",
      },
    },
  },
  pr_: {
    characteristics: "slow",
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "Pulse",
    type: "scatter",
    mode: "markers",
    maxDataPoints: 20,
    cssName: "PR",
    heading: "Pulse Rate",
    trace: {
      0: {
        x: [],
        y: [],
        marker: {
          color: "red", // Specify the color of the markers
        },
        type: "scatter",
        mode: "markers",
      },
    },
  },
  ecg: {
    characteristics: "fast",
    queueName: ECGQueue,
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "ECG",
    type: "log",
    mode: "lines",
    maxDataPoints: 500,
    cssName: "ECG",
    heading: "ECG Data",
    trace: {
      0: {
        x: [],
        y: [],
        marker: {
          color: "red", // Specify the color of the markers
        },
        type: "scatter",
        mode: "lines", 
     
      },
    },
  },
  ppgIR: {
    characteristics: "fast",
    queueName: PPGIRQueue,
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "IR",
    type: "scatter",
    mode: "lines",
    maxDataPoints: 300,
    cssName: "PPGIR",
    heading: "PPG IR Data",
    trace: {
      0: {
        x: [],
        y: [],
        marker: {
          color: "blue", // Specify the color of the markers
        },
        type: "scatter",
        mode: "lines",
      },
    },
  },
  ppgRED: {
    characteristics: "fast",
    queueName: PPGREDQueue,
    xtype: "linear",
    xautorange: true,
    xtitle: "Timestamp",
    ytype: "linear",
    yautorange: true,
    ytitle: "Red",
    type: "scatter",
    mode: "lines",
    maxDataPoints: 300,
    cssName: "PPGRED",
    heading: "PPG RED Data",
    trace: {
      0: {
        x: [],
        y: [],
        marker: {
          color: "red", // Specify the color of the markers
        },
        type: "scatter",
        mode: "lines",
        line: {shape: 'spline'}
      },
    },
  },
};

let fileData = {
  cst: {
    dat: {
      filename: "chest_dat.csv",
      queue: cstdatFileQueue,
    },
    wvf: {
      filename: "chest_wvf.csv",
      queue: cstwvfFileQueue,
    },
  },
  lim: {
    dat: {
      filename: "limb_dat.csv",
      queue: limdatFileQueue,
    },
    wvf: {
      filename: "limb_wvf.csv",
      queue: limwvfFileQueue,
    },
  },
};

class LineBreakTransformer {
  constructor() {
    this.container = "";
  }

  transform(chunk, controller) {
    if (dataReadFlag) {
      const string = Array.from(chunk);
      const hexstring = string
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join(",");
      this.container += hexstring + ",";
      const lines = this.container.split("0d");
      this.container = lines.pop();
      lines.forEach((line) => {
        const lineWithoutCommas = line.replace(/,/g, ""); // Remove commas using regex
        const firstTwoLetters = lineWithoutCommas[0] + lineWithoutCommas[1];
      if (firstTwoLetters === "0a") {
        controller.enqueue(lineWithoutCommas);
      } else {
        console.log("Removing garbage value");
      }
        
      });
    }
  }

  flush(controller) {
    controller.enqueue(this.container);
  }
}

/**
 * Creates a Json request with specified parameters.
 * 
 * @function requestMaker
 * @param {string} request - The request to be made.
 * @param {string} en - The value for 'en' parameter.
 * @param {string} device - The value for 'device' parameter.
 * @param {string} type - The value for 'type' parameter.
 * @param {string} ser - The value for 'ser' parameter.
 * @returns {string} Hex string of created Json request.
 */
function requestMaker(request, en, device, type, ser) {
  let myObject = {};
  switch (request) {
    default:
      {
        console.log("default case");
      }
      break;
    case "stream":
      {
        myObject = {
          req: {
            stream: {
              en: en, //true|false
              dev: device, //"all|cst|lim",
              type: type, //"all|dat|wvf"
            },
          },
        };
      }
      break;

    case "info":
      {
        myObject = {
          req: "inf",
        };
      }
      break;

    case "time":
      {
        myObject = {
          get_time: {
            err: 0,
            time: 1703587122,                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       
          },
        };
      }
      break;

    case "connect":
      {
        myObject = {
          cmd: {
            connect: {
              dev: device,
              ser: ser,
            },
          },
        };
      }
      break;

    case "disconnect":
      {
        myObject = {
          cmd: {
            disconnect: {
              dev: device,
              ser: ser,
            },
          },
        };
      }
      break;
  }

  const json = JSON.stringify(myObject, null, 4);
  // console.log(json);
  const frame = jsonStringToHexArray(json);
  return frame;
}

/**
 * Sends serial data and throws an error if unable to send.
 * 
 * @function sendSerial
 * @param {string} data - The serial data to be sent.
 * @throws {Error} Throws an error if unable to send the data.
 * @returns {null} Returns null as there is no meaningful return value.
 */
function sendSerial(data) {
  const writer = port.writable.getWriter();
  const byteArray = data.match(/.{1,2}/g).map((byte) => parseInt(byte, 16));
  const uint8Array = new Uint8Array(byteArray);
  try {
    writer.write(uint8Array);
    writer.close();
    console.log("Data Written");
  } catch (error) {
    console.error("Error writing to serial port:", error);
    window.alert(error);
  } finally {
    writer.releaseLock();
  }
    
}

/**
 * Converts a JSON string to hexadecimal string.
 * 
 * @function jsonStringToHexArray
 * @param {string} jsonString - The JSON string to be converted.
 * @returns {string} Hexadecimal string derived from the JSON string.
 */
function jsonStringToHexArray(jsonString) {
  // Convert each character of the string to its hexadecimal representation
  let hexArray = [];
  let hexstring = "";
  const len = jsonString.length;
  for (let i = 0; i < len; i++) {
    const hexValue = jsonString
      .charCodeAt(i)
      .toString(16)
      .padStart(2, "0")
      .toUpperCase();
    hexArray.push(hexValue);
  }
  hexArray.forEach((hex) => {
    hexstring += hex.replace(/,/g, ""); // Remove commas using regex
  });
  const framedString = framing(hexstring);
  return framedString;
}

/**
 * Frames a hexadecimal string for transmission.
 * 
 * @function framing
 * @param {string} hexstring - The hexadecimal string to be framed.
 * @returns {string} The framed hexadecimal string ready for transmission.
 */
function framing(hexstring) {
  const start = "0A";
  const ver = "01";
  const lh = "00";
  const ll = (hexstring.length / 2).toString(16);
  const ty = "00";
  const cs = "00";
  const crch = "00";
  const crcl = "00";
  const end = "0D";
  const frame = start.concat(ver, lh, ll, ty, cs, hexstring, crch, crcl, end);
  return frame;
}

/**
 * connectSerial() is responsible for listing available
 * serial ports and connecting with the selected one.
 *
 * @function connectSerial
 * @param {void}
 * @returns {void}
 * @throws {error} -Throws an error if it is unable to connect with selected serial port
 *
 */
async function connectSerial() {

  // method to fetch serial ports using API

  // fetch('http://localhost:5000/serialports')
  // .then(response => {
  //   if (!response.ok) {
  //     throw new Error('Failed to fetch serial ports');
  //   }
  //   return response.json();
  // })
  // .then(ports => {
  //   console.log('Serial ports:', ports);
  //   window.alert(ports);
  //   return ports;
  //   // Use the list of serial ports in your application
  // })
  // .catch(error => {
  //   console.error('Error fetching serial ports:', error);
  // });


    const serialPort = fetch('https://9a9b-2402-8100-27c2-7ca8-22fa-ae-2b16-d6d8.ngrok-free.app/serialports')
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch serial ports');
      }
      return response.json();
    })
    .then(ports => {
      console.log('Serial ports:', ports);
      // Use the list of serial ports in your application
    })
    .catch(error => {
      console.error('Error fetching serial ports:', error);
    });
    // await serialPort.open({ baudRate: 115200 }); // Adjust baud rate as needed
    // console.log('serialport', serialPort);
    console.log('serialPort::::',serialPort);
    return await serialPort;
}

/**
 * Recieves raw data from the UART and processes it further such
 * that data frame values are seperated and the core data json is extracted.
 *
 * @function processData
 * @param {string} data - Raw data from the UART (hexstring)
 * @returns {void}
 * @throws {error} Throws an error if it is unable to process data
 *
 */
async function processData() {
  let part = "";
  let frame = {}; // object for saving frame data key values
  let coreData = {}; // object that saves core data key values
  let data;
  while (1) {
    if (!RawQueue.isEmpty()) {
      try {
        data = RawQueue.dequeue();

        frame.start = data.substr(0, 2);
        frame.version = data.substr(2, 2);
        frame.lh = data.substr(4, 2);
        frame.ll = data.substr(6, 2);
        frame.ty = data.substr(8, 2);
        frame.cs = data.substr(10, 2);
        let len = frame.lh + frame.ll;
        len = parseInt(len, 16) * 2;
        frame.crch = data.substr(len, 2);
        frame.crcl = data.substr(len + 2, 2);
        frame.end = data.substr(len + 4, 2);
        // part = data.substr(12, len);
        part = data;
        frame.coreDataString = hexToString(part);
        const cData = JSON.parse(frame.coreDataString); //TODO: to check whether parsing can be done here so that faulty json produces error
        const csvData = convertJsonStringToCsv(frame.coreDataString);

        coreDataQueue.enqueue(frame.coreDataString);
        data = "";
        console.log(frame.coreDataString);
      } catch (error) {
        console.log("\n\n");
        console.log("ERROR:", frame.coreDataString);
        data = "";
        console.log("Error in data processsing", error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, DataResolveTime));
  }
}

/**
 * Identifies the packet asynchronously and redirects it to its case.
 * 
 * @async
 * @function packetIdentifier
 * @returns {null} 
 * @throws {Error} Throws an error if there is an issue with the job of any case.
 */
async function packetIdentifier() {
  let coreData = {};
  let counter = 0;
  let imageElement = "";
  let deviceButton = "";
  while (1) {
    if (!coreDataQueue.isEmpty()) {
      try {
        counter++;
        const json = coreDataQueue.dequeue();
        const jsonObj = JSON.parse(json);
        const coreMap = new Map();
        for (const [coreKey, coreValue] of Object.entries(jsonObj)) {
          coreMap.set(coreKey, coreValue);
        }
        const packageId = Object.keys(jsonObj)[0];
        switch (packageId) {
          default:
            {
              console.log("default case");
            }
            break;
          case "dat":
            {
              const temp_unit=document.getElementById("tempButton").textContent;
              counter++;
              let array = [[], []];
              for (let i = 0; i <= 1; i++) {
                const keyName = Object.keys(coreMap.get("dat"))[i];

                try {
                  const obj = Object.keys(jsonObj.dat[keyName]);

                  obj.forEach((key) => {
                    
                    if(coreMap.get("dat")[keyName][key]==null){
                      array[i].push('null');  
                    }
                    else{
                      const keyVal=coreMap.get("dat")[keyName][key];
                      if(key=='tmp')
                      {
                        if(temp_unit=="Switch to °C")
                        {
                        array[i].push((((keyVal/10)*(9/5))+32).toFixed(2) + " °F");
                        }
                        else{
                          array[i].push((keyVal/10).toFixed(2) + " °C");
                        }
                      }
                      else{
                    array[i].push(keyVal); // Use key instead of val
                      }
                    }
                  });
                } catch {
                  console.log("NULL value");
                }
              }
              Plot_values(140, 80, array[0], "chestdat", "#dd0d0d");
              Plot_values(520, 80, array[1], "limbdat", "#dd0d0d");

              try {
                const cstTemperature = coreMap.get("dat")["cst"]["tmp"]/10;
                plotting.tmp.trace[0].x.push(counter);
                if (temp_unit=="Switch to °C"){
                plotting.tmp.trace[0].y.push((cstTemperature*(9/5))+32);
                }
                else{
                  plotting.tmp.trace[0].y.push(cstTemperature);
                }
                cstdatFileQueue.enqueue(JSON.stringify(jsonObj.dat.cst));
              } catch {
                console.log("Error getting chest temperature");
              }
              try {
                const limTemperature = coreMap.get("dat")["lim"]["tmp"]/10;
                plotting.tmp.trace[1].x.push(counter);
                if (temp_unit=="Switch to °C"){
                plotting.tmp.trace[1].y.push((limTemperature*(9/5))+32);
                }
                else{
                  plotting.tmp.trace[1].y.push(limTemperature);
                }
                limdatFileQueue.enqueue(JSON.stringify(jsonObj.dat.lim));
              } catch {
                console.log("Error getting limb temperature");
              }
              try {
                const hr = coreMap.get("dat")["cst"]["hr_"];
                plotting.hr_.trace[0].x.push(counter);
                plotting.hr_.trace[0].y.push(hr);
              } catch {
                console.log("Error getting hr");
              }
              try {
                const sp = coreMap.get("dat")["lim"]["sp2"];
                plotting.sp2.trace[0].x.push(counter);
                plotting.sp2.trace[0].y.push(sp);
              } catch {
                console.log("Error getting sp2");
              }

              try {
                const pr = coreMap.get("dat")["lim"]["pr_"];
                plotting.pr_.trace[0].x.push(counter);
                plotting.pr_.trace[0].y.push(pr);
              } catch {
                console.log("Error getting pr");
              }

              updateChart(plotting.tmp);
              updateChart(plotting.hr_);
              updateChart(plotting.sp2);
              updateChart(plotting.pr_);
            }
            break;
          case "wvf":
            {
              coreData.time = coreMap.get("wvf").t_s;
              const keyName = Object.keys(coreMap.get("wvf"))[2];
              if (keyName == "ecg") {
                coreData.yEntity = coreMap.get("wvf")[keyName];
                let x = [];
                let y = [[], []];
                let xVal = coreData.time;
                const len = coreData.yEntity.length;
                for (let i = 0; i < len; i++) {
                  if(1)//coreData.yEntity[i]<500 || coreData.yEntity[i]>5000)     //ECG filter
                  {
                  x.push(xVal);
                  xVal = xVal + timeDiff;
                  const ecgData = coreData.yEntity[i];
                  y[0].push(ecgData);
                  }
                }
                plotting[keyName].queueName.enqueue({
                  time: x,
                  yEntity: y,
                });
                if (writeFlag) {
                  cstwvfFileQueue.enqueue(json);
                }
              } else {
                coreData.yEntity = coreMap.get("wvf")[keyName];
                let x = [];
                let yIR = [[], []];
                let yRED = [[], []];
                let xVal = coreData.time;
                const len = coreData.yEntity.length;
                for (let i = 0; i < len; i++) {
                  x.push(xVal);
                  const ppgRED = coreData.yEntity[i];
                  yRED[0].push(ppgRED);
                  // IR and RED data seperation
                  // if (i % 2 == 0) {
                  //   const ppgRED = coreData.yEntity[i];
                  //   yRED[0].push(ppgRED);
                  // } else {
                  //   const ppgIR = coreData.yEntity[i];
                  //   yIR[0].push(ppgIR);
                  // }
                  xVal = xVal + timeDiffppg;
                }

                // PPGIRQueue.enqueue({
                //   time: x,
                //   yEntity: yIR,
                // });
                PPGREDQueue.enqueue({
                  time: x,
                  yEntity: yRED,
                });
                if (writeFlag) {
                  limwvfFileQueue.enqueue(json);
                }
              }
            }
            break;
          case "inf":
            {
              let array = [];
              try {
                generateTable(jsonObj.inf.ANNENET, 110, 100);
              } catch (error) {
                window.alert(error);
              }
            }
            break;
          case "evt":
            {
              const val = coreMap.get("evt").type;
              if (val == "connected") {
                if (coreMap.get("evt").dev == "lim") {
                  imageElement = document.getElementById("limbimg");
                  document.getElementById("limbButton").textContent =
                    "Disconnect " + coreMap.get("evt").ser;
                  toggleglowImage(imageElement, true);
                  evtname = imageElement;
                } else {
                  imageElement = document.getElementById("chestimg");
                  document.getElementById("chestButton").textContent =
                    "Disconnect " + coreMap.get("evt").ser;
                  toggleglowImage(imageElement, true);
                  evtname = imageElement;
                }
              } else if (val == "notification") {
                toggleglowImage(imageElement, false);
                glowImage(imageElement, true);
              } else if (val == "nfc_detected") {
                const ser = coreMap.get("evt").ser;
                if (coreMap.get("evt").dev == "cst") {
                  deviceButton = "chestButton";
                } else {
                  deviceButton = "limbButton";
                }
                const text = document
                  .getElementById(deviceButton)
                  .textContent.split(" ")[0];
                switch (text) {
                  default:
                    {
                      console.log("default case");
                    }
                    break;
                  case "Sensor":
                    {
                      document.getElementById(deviceButton).disabled = false;
                      const buttonWidget =
                        document.getElementById(deviceButton);
                      buttonWidget.textContent = "Connect " + ser;
                      if (deviceButton == "chestButton") {
                        chestTimeoutId = setTimeout(() => {
                          buttonWidget.textContent = "Sensor Status";
                          buttonWidget.disabled = true;
                        }, 5000);
                      } else {
                        limbTimeoutId = setTimeout(() => {
                          buttonWidget.textContent = "Sensor Status";
                          buttonWidget.disabled = true;
                        }, 5000);
                      }
                    }
                    break;
                  case "Connect":
                    {
                      document.getElementById(deviceButton).disabled = false;
                      const buttonWidget =
                        document.getElementById(deviceButton);
                      buttonWidget.textContent = "Connect " + ser;
                    }
                    break;

                  case "Disconnect":
                    {
                      const oldtext =
                        document.getElementById(deviceButton).textContent;
                      const buttonWidget =
                        document.getElementById(deviceButton);
                      if (oldtext != "Disconnect " + ser) {
                        //to check if the same sensor is tapped again
                        document.getElementById(deviceButton).disabled = false;
                        buttonWidget.textContent = "Connect " + ser;
                        if (deviceButton == "chestButton") {
                          chestTimeoutId = setTimeout(() => {
                            buttonWidget.textContent = oldtext;
                          }, 5000);
                        }
                      } else {
                        limbTimeoutId = setTimeout(() => {
                          buttonWidget.textContent = oldtext;
                        }, 5000);
                      }
                    }
                    break;
                }
              }
            }
            break;
          case "ack":
            {
              if (Object.keys(coreMap.get("ack")) == "disconnect") {
                if (chestDisconnPress) {
                  chestDisconnPress = false;
                  imageElement = document.getElementById("chestimg");
                  glowImage(imageElement, false);
                  imageElement = document.getElementById("chestButton");
                  imageElement.textContent = "Sensor Status";
                  imageElement.disabled = true;
                } else {
                  limbDisconnPress = false;
                  imageElement = document.getElementById("limbimg");
                  glowImage(imageElement, false);
                  imageElement = document.getElementById("limbButton");
                  imageElement.textContent = "Sensor Status";
                  imageElement.disabled = true;
                }
              }
            }
            break;
        }
      } catch (error) {
        console.log(error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, DataResolveTime));
  }
}

/**
 * Responsible for updating the graph values.
 * It recieves the object that signifies which chart needs to be updated
 *
 * @async
 * @function updateChart
 * @param {object} - Recieves object which contain graph characteristics for respective parameter
 * @returns {void}
 * @throws {error} - Throws error if promise is not resolved (data is not plotted) within the GraphResolveTime
 *
 */
async function updateChart(obj) {
  const layout = {
    xaxis: {
      type: obj.xtype,
      autorange: obj.xautorange,
      title: obj.xtitle,
    },
    yaxis: {
      type: obj.ytype,
      autorange: obj.yautorange,
      title: obj.ytitle,
      // range:[-15000,15000]
    },
  };
  let data = "";
  let traceArray = [];
  if (obj.characteristics == "fast") {
    while (1) {
      if (!obj.queueName.isEmpty()) {
        data = obj.queueName.dequeue();
        const len = data.yEntity.length;
        const xval = data.time;
        const yval = data.yEntity;
        for (let j = 0; j < len; j++) {
          const length = data.yEntity[j].length;
          for (let i = 0; i < length; i++) {
            obj.trace[j].x.push(xval[i]);
            obj.trace[j].y.push(yval[j][i]);
          }
        }
        datapointsOnGraph();
        traceArray = [];
        data = "";
      }
      await new Promise((resolve) => setTimeout(resolve, GraphResolveTime));
    }
  } else {
    datapointsOnGraph();
  }
  function datapointsOnGraph() {
    const len = Object.keys(obj.trace).length;
    const maxDataPoints = obj.maxDataPoints;
    for (let i = 0; i < len; i++) {
      if (obj.trace[i].x.length > maxDataPoints) {
        obj.trace[i].x = obj.trace[i].x.slice(-maxDataPoints);
        obj.trace[i].y = obj.trace[i].y.slice(-maxDataPoints);
      }
    }
    for (let i = 0; i < len; i++) {
      traceArray.push(obj.trace[i]);
    }
    Plotly.update(obj.cssName, [traceArray], layout);
    
  }

}

/**
 * Responsible for reading chunks of data from the UART
 * and splitting it according to Sibel's data frame.
 *
 * @async
 * @function readStream
 * @param {reader}  -Recieves reader object for the respective port
 * @returns {void}
 * @throws {error} - Throws an error if it is unable to read data
 *
 */
async function readStream(reader) {
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      RawQueue.enqueue(value);
      await new Promise((resolve) => setTimeout(resolve, DataResolveTime));
    }
  } catch (error) {
    console.error("Error reading data:", error);
  } finally {
    console.log("closing the port");
    window.alert("PORT Disconnected. Please Reload!!!");
    connectButton.textContent = "Disconnected!";
    connectButton.classList.add("stop");
    // Close the port when done
    await port.close();
  }
}

/**
 * Responsible for configuration of line break transfromers.
 *
 * @async
 * @function port_conf
 * @param {port}  -Recieves port
 * @returns {reader} - Reader object that will be passed on to the read stream
 * @throws {void}
 *
 */
async function port_conf() {
  // Create a line break transformer
  const lineBreakTransformer = new LineBreakTransformer();

  // Pipe the readable stream through the text decoder and line break transformer
  const transformedStream = port.readable.pipeThrough(
    new TransformStream(lineBreakTransformer)
  );

  // Create a reader for the transformed stream
  const reader = transformedStream.getReader();
  return reader;
}

/**
 * Responsible for converting hexString to meaningful text string.
 *
 * @function hexToString
 * @param {hexString}  -Recieves hexString
 * @returns {String} - Returns converted string
 * @throws {error} - Throws error if recieves an invalid string
 *
 */
function hexToString(hexString) {
  // Ensure the input has an even length
  if (hexString.length % 2 !== 0) {
    throw new Error("Invalid hex string");
  }

  // Convert pairs of characters to decimal and then to characters
  const byteArray = [];
  for (let i = 0; i < hexString.length; i += 2) {
    byteArray.push(parseInt(hexString.substr(i, 2), 16));
  }
  // Use String.fromCharCode to convert the array of decimal values to a string
  return String.fromCharCode.apply(null, byteArray);
}

/**
 * Responsible for plotting the graph including the axis, heading and title.
 *
 * @function Plot_Graph
 * @param {object} - Recieves object which contain graph characteristics for respective parameter
 * @returns {void}
 * @throws {void}
 *
 */
function Plot_Graph(obj) {
  let traceArray = [];
  const layout = {
    xaxis: {
      type: obj.xtype,
      autorange: obj.xautorange,
      title: obj.xtitle,
    },
    yaxis: {
      type: obj.ytype,
      autorange: obj.yautorange,
      title: obj.ytitle,
      
    },
    title: {
      text: obj.heading,
      x: 0.5, // X-coordinate for title (0.0 to 1.0 for relative position)
      y: 0.8, // Y-coordinate for title (0.0 to 1.0 for relative position)
    },
  };

  const len = Object.keys(obj.trace).length;
  for (let i = 0; i < len; i++) {
    traceArray.push(obj.trace[i]);
  }

  Plotly.newPlot(obj.cssName, traceArray, layout, { displayModeBar: false });
}

/**
 * Asynchronously creates a new file.
 * 
 * @async
 * @function createFile
 * @returns {null}
 */
async function createFile() {
  const handle = await window.showDirectoryPicker();
  for (let fileType in fileData) {
    for (let subType in fileData[fileType]) {
      const name = fileData[fileType][subType].filename;
      const fileHandle = await handle.getFileHandle(name, { create: true });
      const writable = await fileHandle.createWritable();
      fileData[fileType][subType].writer = writable;
    }
  }
}

/**
 * Asynchronously writes data from a queue to a writer object.
 * 
 * @async
 * @function writeToFile
 * @param {object} writerObj - The object used for writing data.
 * @param {object} queue - The queue containing data to be written.
 * @returns {null} 
 * @throws {Error} Throws an error if there's an issue writing data to the file.
 */
async function writeToFile(writerObj, queue) {
  while (writeFlag) {
    if (!queue.isEmpty()) {
      try {
        const data = queue.dequeue();
        const csvData = convertJsonStringToCsv(data);
        await writerObj.write(csvData + "\n");
      } catch (error) {
        console.log(error);
        window.alert(error);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  console.log("File closed");
}

/**
 * Asynchronously plots values on an HTML element using provided data array and color.
 * 
 * @async
 * @function Plot_values
 * @param {number} left - The left position for the plot.
 * @param {number} top - The top position for the plot.
 * @param {string} dataArray - The array containing values to be plotted.
 * @param {HTMLElement} htmlref - The reference to the HTML element where the plot will be rendered.
 * @param {string} colour - The color to be used for the plot.
 * @returns {null} 
 * 
 */
async function Plot_values(left, top, dataArray, htmlref, colour) {
  const dataContainer = document.getElementById(htmlref);
  dataContainer.innerHTML = "";
  let topPosition = top;
  // Iterate through data points and create elements dynamically
  dataArray.forEach((data) => {
    const dataPointElement = document.createElement("div");
    dataPointElement.className = "dataPoint";
    dataPointElement.textContent = data;

    // Set the top position for the data point
    dataPointElement.style.left = `${left}px`;
    dataPointElement.style.top = `${topPosition}px`;
    dataPointElement.style.color = colour;
    // Increment the top position for the next data point
    topPosition += 30; // Adjust the spacing between points as needed

    // Append the created element to the container
    dataContainer.appendChild(dataPointElement);
  });
}

/**
 * Applies a glowing effect to an image based on the provided status.
 * 
 * @function glowImage
 * @param {HTMLImageElement} imageElement - The image element to apply the glowing effect to.
 * @param {boolean} status - The status indicating whether the glow effect should be applied or removed.
 */
function glowImage(imageElement, status) {
  if (status) {
    imageElement.style.boxShadow = "0 0 20px 5px rgba(0, 255, 0, 0.7)";
  } else {
    imageElement.style.boxShadow = "none";
  }
}

/**
 * Toggles the glowing effect of an image element based on the provided status.
 * 
 * @function toggleglowImage
 * @param {HTMLImageElement} imageElement - The image element to apply or remove the blinking effect from.
 * @param {boolean} status - The status indicating whether to apply (true) or remove (false) the blinking effect.
 * @param {number} [intervalDuration=300] - The duration in milliseconds for the glow animation interval. Defaults to 300 milliseconds.
 */
function toggleglowImage(imageElement, status, intervalDuration = 300) {
  if (status) {
    glowStatus = !glowStatus;

    intervalId = setInterval(() => {
      if (glowStatus) {
        imageElement.style.boxShadow = "0 0 20px 5px rgba(0, 255, 0, 0.7)";
      } else {
        imageElement.style.boxShadow = "none";
      }
      glowStatus = !glowStatus; // Toggle glowStatus on each interval
    }, intervalDuration);
  } else {
    clearInterval(intervalId);
    imageElement.style.boxShadow = "none";
  }
}

/**
 * Recursively flattens a JSON object into a one-level object, with keys concatenated based on nesting.
 * 
 * @function flattenJson
 * @param {object} jsonObj - The JSON object to be flattened.
 * @param {string} [parentKey=""] - The parent key used for concatenation of nested keys. Defaults to an empty string.
 * @param {object} [result={}] - The resulting flattened object. Used for recursion, should not be provided externally.
 * @returns {object} The flattened JSON object.
 */
function flattenJson(jsonObj, parentKey = "", result = {}) {
  for (let key in jsonObj) {
    let newKey = parentKey ? `${parentKey}.${key}` : key;

    if (typeof jsonObj[key] === "object" && jsonObj[key] !== null) {
      flattenJson(jsonObj[key], newKey, result);
    } else {
      result[newKey] = jsonObj[key];
    }
  }

  return result;
}

/**
 * Generates an HTML table from the provided data and positions it at the specified top-left coordinates.
 * 
 * @function generateTable
 * @param {string} data - The data to populate the table. Each inner array represents a row.
 * @param {number} top - The top position for the table.
 * @param {number} left - The left position for the table.
 * @returns {null}
 */
function generateTable(data, top, left) {
  const tableContainer = document.getElementById("info-container");
  tableContainer.innerHTML = "";
  const table = document.createElement("table");
  const dataRow = document.createElement("tr");

  // Create alternating key and value cells
  for (const key in data) {
    const keyCell = document.createElement("th");
    keyCell.textContent = key.toUpperCase() + ":";
    keyCell.className = "key";
    dataRow.appendChild(keyCell);

    const valueCell = document.createElement("td");
    valueCell.textContent = data[key];
    valueCell.className = "value";
    dataRow.appendChild(valueCell);
  }

  // Append the data row to the table
  table.appendChild(dataRow);

  // Append the table to the container
  tableContainer.appendChild(table);
  tableContainer.style.display = "block";
  tableContainer.style.position = "absolute";
  tableContainer.style.top = `${top}px`;
  tableContainer.style.left = `${left}px`;

  setTimeout(function () {
    let opacity = 0;
    const interval = 50; // Adjust as needed
    const duration = 100; // 2 seconds
    const increment = interval / duration;

    const opacityInterval = setInterval(function () {
      opacity += increment;
      table.style.opacity = opacity;

      if (opacity >= 1) {
        clearInterval(opacityInterval); // Stop the interval when opacity reaches 1
      }
    }, interval);
  }, 0);
}

/**
 * Converts a JSON string to CSV format.
 * 
 * @function convertJsonStringToCsv
 * @param {string} jsonString - The JSON string to be converted to CSV format.
 * @returns {string|null} The CSV representation of the JSON data, or null if there's an error.
 * @throws {Error} Throws an error if there's an issue parsing the JSON string or converting it to CSV format.
 */
function convertJsonStringToCsv(jsonString) {
  try {
    const jsonData = JSON.parse(jsonString);

    // Convert JSON to an array of objects
    const jsonArray = Array.isArray(jsonData) ? jsonData : [jsonData];

    // Flatten each object in the array
    const flattenedArray = jsonArray.map((obj) => flattenJson(obj));

    // Get unique keys from all flattened objects
    const keys = Array.from(
      new Set(flattenedArray.flatMap((obj) => Object.keys(obj)))
    );

    // Create CSV header
    const csvHeader = keys.join(",");

    // Create CSV rows
    const csvRows = flattenedArray.map((obj) =>
      keys.map((key) => obj[key] || "").join(",")
    );

    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join("\n");

    return csvContent;
  } catch (error) {
    console.error("Error parsing JSON:", error.message);
    return null;
  }
}

/*MAIN begins from here*/
//Plot the blank graph first

Plot_Graph(plotting.tmp);
// Plot_Graph(plotting.ppgIR);
Plot_Graph(plotting.ecg);
Plot_Graph(plotting.hr_);
Plot_Graph(plotting.sp2);
Plot_Graph(plotting.pr_);
Plot_Graph(plotting.ppgRED);
const chestdataPoints = [
  "Error:",
  "Serial No.:",
  "Heart Rate:",
  "Temperature:",
  "Battery:",
  "RSSI:",
  "Message:",
];
const limbdataPoints = [
  "Error:",
  "Serial No.:",
  "SpO2:",
  "Pulse:",
  "Perfusion Index:",
  "Temperature:",
  "Battery:",
  "RSSI:",
  "Message:",
];

document.getElementById("version").textContent = websiteVersion;
Plot_values(30, 80, chestdataPoints, "chestkeys", "#0995c0");
Plot_values(380, 80, limbdataPoints, "limbkeys", "#0995c0");

document.getElementById("Stream").disabled = true;
document.getElementById("logging").disabled = true;
document.getElementById("infoButton").disabled = true;
document.getElementById("chestButton").disabled = true;
document.getElementById("limbButton").disabled = true;
//connect with the uart port
document.getElementById("connectButton").addEventListener("click", async () => {
  console.log('inside this event listener');
  port = await connectSerial();
  // If the port is available then :
  if (port) {
    document.getElementById("Stream").disabled = false;
    document.getElementById("logging").disabled = false;
    document.getElementById("infoButton").disabled = false;
    Stream.classList.add("start");
    logging.classList.add("start");
    document.getElementById("connectButton").disabled = true;
    connectButton.textContent = "Connected!";
    connectButton.classList.add("start");
    const reader = await port_conf();
    //  Start reading
    readStream(reader);
    processData();
    packetIdentifier();
    // update chart w.r.t values read
    updateChart(plotting.ecg);
    updateChart(plotting.ppgIR);
    updateChart(plotting.ppgRED);
  }
});
document.getElementById("logging").addEventListener("click", async () => {
  if (logging.textContent == "Start logging") {
    try {
      await createFile();
      writeFlag = true;
      logging.textContent = "Stop logging";
      logging.classList.remove("start");
      logging.classList.add("stop");

      for (let fileType in fileData) {
        for (let subType in fileData[fileType]) {
          const writerObj = fileData[fileType][subType].writer;
          const queue = fileData[fileType][subType].queue;
          writeToFile(writerObj, queue, true);
        }
      }
    } catch (error) {
      window.alert(error);
    }
  } else {
    logging.textContent = "Start logging";
    logging.classList.remove("stop");
    logging.classList.add("start");
    writeFlag = false;
    for (let fileType in fileData) {
      for (let subType in fileData[fileType]) {
        const writerObj = fileData[fileType][subType].writer;
        writerObj.close();
      }
    }
  }
});
document.getElementById("Stream").addEventListener("click", async () => {
  let frame = "";
  if (Stream.textContent == "Start Stream") {
    frame = requestMaker("stream", true, "all", "all", null);
    Stream.textContent = "Stop Stream";
    Stream.classList.remove("start");
    Stream.classList.add("stop");
  } else {
    frame = requestMaker("stream", false, "all", "all", null);
    Stream.textContent = "Start Stream";
    Stream.classList.remove("stop");
    Stream.classList.add("start");
  }
  await sendSerial(frame);
});
document.getElementById("infoButton").addEventListener("click", async () => {
  let frame = "";
  frame = requestMaker("info", true, "all", "all", null);
  // Stream.textContent = "Showing info";
  sendSerial(frame);
});
document.getElementById("chestButton").addEventListener("click", async () => {
  let frame = "";
  clearTimeout(chestTimeoutId);

  if (chestButton.textContent.split(/\b/).includes("Disconnect")) {
    const text = document.getElementById("chestButton").textContent;
    const ser = text.replace("Disconnect ", "").trim();
    frame = requestMaker("disconnect", true, "cst", "all", ser);
    chestDisconnPress = true;
  } else {
    const text = document.getElementById("chestButton").textContent;
    const ser = text.replace("Connect ", "").trim();
    frame = requestMaker("connect", true, "cst", "all", ser);
  }
  sendSerial(frame);
});
document.getElementById("limbButton").addEventListener("click", async () => {
  let frame = "";
  clearTimeout(limbTimeoutId);
  if (limbButton.textContent.split(/\b/).includes("Disconnect")) {
    const text = document.getElementById("limbButton").textContent;
    const ser = text.replace("Disconnect ", "").trim();
    frame = requestMaker("disconnect", true, "lim", "all", ser);
    limbDisconnPress = true;
  } else {
    const text = document.getElementById("limbButton").textContent;
    const ser = text.replace("Connect ", "").trim();
    frame = requestMaker("connect", true, "lim", "all", ser);
  }
  sendSerial(frame);
});
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "hidden") {
    // Page is now hidden,  data streaming stopped
    dataReadFlag = false;
  } else {
    // Page is now visible, resume normal data streaming
    dataReadFlag = true;
  }
});
document.getElementById("tempButton").addEventListener("click", async () => {
  plotting.tmp.trace[0].y=[];
    plotting.tmp.trace[1].y=[];
  if (tempButton.textContent == "Switch to °F") {
    tempButton.textContent = "Switch to °C";
    plotting.tmp.ytitle="Temperature (in °F)";
  } else {
    tempButton.textContent = "Switch to °F";
    plotting.tmp.ytitle="Temperature (in °C)";
  }
});
