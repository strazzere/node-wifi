const execFile = require('child_process').execFile;
const env = require('./env');

function getProfiles(_config, callback) {
  try {
    execFile(
      'netsh',
      ['wlan', 'show', 'profiles'],
      { env },
      (err, profileResults) => {
        if (err) {
          callback && callback(err);
          return;
        }

        profileResults = profileResults
          .toString('utf8')
          .split('\r')
          .join('')
          .split('\n')
          .slice(5, profileResults.length);

        const profiles = [];
        for (let i = 0; i < profileResults.length; i++) {
          if (profileResults[i].includes(':')) {
            profiles.push(profileResults[i].substring(profileResults[i].indexOf(':') + 1))
          }
        }

        callback && callback(null, profiles);
      }
    );
  } catch (e) {
    callback && callback(e);
  }
}

module.exports = config => {
  return callback => {
    if (callback) {
      getProfiles(config, callback);
    } else {
      return new Promise((resolve, reject) => {
        getProfiles(config, (err, profiles) => {
          if (err) {
            reject(err);
          } else {
            resolve(profiles);
          }
        });
      });
    }
  };
};
