const config = {
  paths: ["features/**/*.feature"],
  require: ["features/step-definitions/**/*.ts", "features/support/**/*.ts"],
  requireModule: ["ts-node/register/transpile-only"],
  format: [
    ['progress-bar'],
    ['html:cucumber-report.html']
  ],
  formatOptions: { snippetInterface: 'async-await' },
  publishQuiet: true,
  timeout: 60000 // 60 second timeout
};

module.exports = config;