const execFile = require('child_process').execFile;
const env = require('./env');

function getInterfaces(_config, callback) {
  const args = [];
  args.push('device');

  execFile('nmcli', args, { env }, (err, deviceResults) => {
    if (err) {
      callback && callback(err);
      return;
    }

    const lines = deviceResults.split('\n');

    const devices = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] !== '') {
        const fields = lines[i]
          .split(' ')
          .filter(substring => substring.length > 0);
        if (fields[1] === 'wifi') {
          devices.push({
            iface: fields[0],
            status: fields[2],
            ssid: fields[3]
          });
        }
      }
    }
    callback && callback(null, devices);
  });
}

module.exports = config => {
  return callback => {
    if (callback) {
      getInterfaces(config, callback);
    } else {
      return new Promise((resolve, reject) => {
        getInterfaces(config, (err, devices) => {
          if (err) {
            reject(err);
          } else {
            resolve(devices);
          }
        });
      });
    }
  };
};
