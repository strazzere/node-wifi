const fs = require('fs').promises;
const execFile = require('child_process').execFile;
const env = require('./env');
const scan = require('./windows-scan');
const profiles = require('./windows-profiles');
const path = require('path');
const os = require('os');
const profileFilename = path.join(os.tmpdir(), 'nodeWifiConnect.xml');

function execCommand(cmd, params) {
  return new Promise((resolve, reject) => {
    execFile(cmd, params, { env, shell: true }, (err, stdout, stderr) => {
      if (err) {
        // Add command output to error, so it's easier to handle
        err.stdout = stdout;
        err.stderr = stderr;

        reject(err);
      } else {
        resolve(stdout);
      }
    });
  });
}

function connectToWifi(config, givenAP, callback) {
  let selectedAp = null;
  let profile;
  if (givenAP.isHidden) {
    selectedAp = {
      ssid: givenAP.ssid,
      security: ['WPA2']
    };
    profile = new Promise(resolve => resolve(selectedAp));
  } else {
    profile = scan(config)().then(networks => {
      selectedAp = networks.find(network => {
        return network.ssid === givenAP.ssid;
      });
      return Promise.resolve(selectedAp);
    });
  }

  profile
    .then(resolvedAP => {
      if (resolvedAP == null) {
        return Promise.reject('SSID not found');
      }

      const savedProfile = profiles(config)().then(savedProfiles => {
        let saved = savedProfiles.find(saved => {
          return saved === givenAP.ssid;
        });
        return Promise.resolve(saved);
      });

      if (savedProfile) {
        const cmd = 'netsh';
        const params = [
          'wlan',
          'connect',
          `ssid="${givenAP.ssid}"`,
          `name="${savedProfile}"`
        ];
        if (config.iface) {
          params.push(`interface="${config.iface}"`);
        }
        return execCommand(cmd, params).then(() => callback && callback());
      } else {
        fs.writeFile(
          profileFilename,
          win32WirelessProfileBuilder(
            resolvedAP,
            givenAP.password,
            givenAP.isHidden
          )
        )
          .then(() => {
            return execCommand('netsh', [
              'wlan',
              'add',
              'profile',
              `filename=${profileFilename}`
            ])
              .then(() => {
                const cmd = 'netsh';
                const params = [
                  'wlan',
                  'connect',
                  `ssid="${givenAP.ssid}"`,
                  `name="${givenAP.ssid}"`
                ];
                if (config.iface) {
                  params.push(`interface="${config.iface}"`);
                }
                return execCommand(cmd, params);
              })
              .then(() => execCommand(`del ${profileFilename}`))
              .then(() => callback && callback())
              .catch(err => {
                execFile(
                  'netsh',
                  ['wlan', 'delete', `profile "${givenAP.ssid}"`],
                  { env },
                  () => {
                    callback && callback(err);
                  }
                );
              });
          })
          .catch(e => Promise.reject(e));
      }
    })
    .catch(e => Promise.reject(e));
}

function getHexSsid(plainTextSsid) {
  let i, j, ref, hex;

  hex = '';

  for (
    i = j = 0, ref = plainTextSsid.length - 1;
    ref >= 0 ? j <= ref : j >= ref;
    i = ref >= 0 ? ++j : --j
  ) {
    hex += plainTextSsid.charCodeAt(i).toString(16);
  }

  return hex;
}

function win32WirelessProfileBuilder(selectedAp, key, isHidden = false) {
  let profile_content = `<?xml version="1.0"?> <WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"> <name>${
    selectedAp.ssid
  }</name> <SSIDConfig> <SSID> <hex>${getHexSsid(
    selectedAp.ssid
  )}</hex> <name>${selectedAp.ssid}</name> </SSID> ${
    isHidden ? '<nonBroadcast>true</nonBroadcast>' : ''
  } </SSIDConfig>`;

  if (selectedAp.security.includes('WPA2')) {
    profile_content += `<connectionType>ESS</connectionType> <connectionMode>auto</connectionMode> <autoSwitch>true</autoSwitch> <MSM> <security> <authEncryption> <authentication>WPA2PSK</authentication> <encryption>AES</encryption> <useOneX>false</useOneX> </authEncryption> <sharedKey> <keyType>passPhrase</keyType> <protected>false</protected> <keyMaterial>${key}</keyMaterial> </sharedKey> </security> </MSM>`;
  } else if (selectedAp.security.includes('WPA')) {
    profile_content += `<connectionType>ESS</connectionType> <connectionMode>auto</connectionMode> <autoSwitch>true</autoSwitch> <MSM> <security> <authEncryption> <authentication>WPAPSK</authentication> <encryption>TKIP</encryption> <useOneX>false</useOneX> </authEncryption> <sharedKey> <keyType>passPhrase</keyType> <protected>false</protected> <keyMaterial>${key}</keyMaterial> </sharedKey> </security> </MSM>`;
  } else {
    if (selectedAp.security_flags.includes('WEP')) {
      profile_content += `<connectionType>ESS</connectionType> <connectionMode>auto</connectionMode> <autoSwitch>true</autoSwitch> <MSM> <security> <authEncryption> <authentication>open</authentication> <encryption>WEP</encryption> <useOneX>false</useOneX> </authEncryption> <sharedKey> <keyType>networkKey</keyType> <protected>false</protected> <keyMaterial>${key}</keyMaterial> </sharedKey> </security> </MSM>`;
    } else {
      profile_content +=
        '<connectionType>ESS</connectionType> <connectionMode>manual</connectionMode> <MSM> <security> <authEncryption> <authentication>open</authentication> <encryption>none</encryption> <useOneX>false</useOneX> </authEncryption> </security> </MSM>';
    }
  }

  profile_content += '</WLANProfile>';
  return profile_content;
}

module.exports = config => {
  return (ap, callback) => {
    if (callback) {
      connectToWifi(config, ap, callback);
    } else {
      return new Promise((resolve, reject) => {
        connectToWifi(config, ap, err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    }
  };
};
