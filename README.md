# Crypto Broker CLI (TS)

## Usage

This Crypto Broker CLI is an example CLI app written in TypeScript to allow users to interact with a Crypto Broker Server using the [crypto-broker-client-js](https://github.com/open-crypto-broker/crypto-broker-client-js) library.

## Development

This section covers how to contribute to the project and develop it further.

### Pre-requisites

In order to develop and build the project locally, you need Node.js installed and run the installation with `npm install`.

For running commands using the `Taskfile` tool, you need to have Taskfile installed. Please check the documentation on [how to install Taskfile](https://taskfile.dev/installation/). If you don't have Taskfile support, you can directly use the commands specified in the Taskfile on your local terminal, provided you meet the requirements.

Please note, that the generated files are supposed to be committed to the repository.

Additionally, this repository uses husky as a pre-commit hook for the project.
Make sure to run `npm install` at least once before committing to this repository.

The [server repository](https://github.com/open-crypto-broker/crypto-broker-server/), is recommended in order to perform end-to-end testing.

### Building

The source code is under the `/src` folder. This code is compiled and the output saved in the `/dist` folder.
To compile the binaries you can use `npm run build`, or simply use the Taskfile:

```bash
task build
```

For building the Docker image, you need to have Docker/Docker Desktop or any other alternative (e.g. Podman) installed.
Further, the installation of docker-buildx is recommended. Note: `task tools` will install this.

If you want to additionally invoke the local pipeline, you can run all of these commands with:

```bash
task ci
```

You can do a local end-to-end testing of the application yourself with the provided CLI. To run the CLI, you first need to have the [Crypto Broker server](https://github.com/open-crypto-broker/crypto-broker-server/) running in your Unix localhost environment. Once done, you can run one of the following in another terminal:

```bash
task test-hash
# or
task test-sign
```

Note: For the sign command, you need to have the [deployment repository](https://github.com/open-crypto-broker/crypto-broker-deployment) in the same parent directory as this repository. Check the command definitions in the `package.json` file to run your own custom commands.

## CLI Installation

After building, it might be preferable to install the CLI app on your local machine as a command line tool. This can be done with:

```bash
npm install -g
```

Note: This might need higher privileges and $PATH to be adjusted.

The CLI can then be used via the "cryptobroker-cli" command.

Note: The [server application](https://github.com/open-crypto-broker/crypto-broker-server/) must be running locally.

## Support, Feedback, Contributing

This project is open to feature requests/suggestions, bug reports etc. via [GitHub issues](https://github.com/open-crypto-broker/crypto-broker-client-js/issues). Contribution and feedback are encouraged and always welcome. For more information about how to contribute, the project structure, as well as additional contribution information, see our [Contribution Guidelines](CONTRIBUTING.md).

## Security / Disclosure

If you find any bug that may be a security problem, please follow our instructions at [in our security policy](https://github.com/open-crypto-broker/crypto-broker-client-js/security/policy) on how to report it. Please do not create GitHub issues for security-related doubts or problems.

## Code of Conduct

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone. By participating in this project, you agree to abide by its [Code of Conduct](https://github.com/open-crypto-broker/.github/blob/main/CODE_OF_CONDUCT.md) at all times.

## Licensing

Copyright 2025 SAP SE or an SAP affiliate company and Open Crypto Broker contributors. Please see our [LICENSE](LICENSE) for copyright and license information. Detailed information including third-party components and their licensing/copyright information is available [via the REUSE tool](https://api.reuse.software/info/github.com/open-crypto-broker/crypto-broker-client-js).
