const execFile = require('child_process').execFile;
const env = require('./env');

function parseShowInterfaces(stdout) {
  const lines = stdout.split('\r\n');
  const connections = [];
  let i = 3;
  while (lines.length > i + 18) {
    const tmpConnection = {};
    const fields = [
      'name',
      'description',
      'guid',
      'mac',
      'type',
      'state',
      'ssid',
      'bssid',
      'mode',
      'radio',
      'authentication',
      'encryption',
      'connection',
      'channel',
      'reception',
      'transmission',
      'signal',
      'profile'
    ];
    for (let j = 0; j < fields.length; j++) {
      const line = lines[i + j];
      tmpConnection[fields[j]] = line.match(/.*: (.*)/)[1];
    }

    connections.push({
      iface: tmpConnection.name,
      status: tmpConnection.state,
      ssid: tmpConnection.ssid,
    });

    i = i + 18;
  }

  return connections;
}

function getInterfaces(config, callback) {
  const params = ['wlan', 'show', 'interfaces'];
  execFile('netsh', params, { env }, (err, stdout) => {
    if (err) {
      callback && callback(err);
    } else {
      try {
        const connections = parseShowInterfaces(stdout, config);
        callback && callback(null, connections);
      } catch (e) {
        callback && callback(e);
      }
    }
  });
}

module.exports = config => {
  return callback => {
    if (callback) {
      getInterfaces(config, callback);
    } else {
      return new Promise((resolve, reject) => {
        getInterfaces(config, (err, connections) => {
          if (err) {
            reject(err);
          } else {
            resolve(connections);
          }
        });
      });
    }
  };
};
