import { Buffer } from 'node:buffer';
import process from 'node:process';
import { CryptoBrokerClient } from '@open-crypto-broker/cryptobroker-client';

function respond(method, payload, response) {
  process.send({ method, payload });
  process.disconnect();
  if (process.env.CLI_TEST_RPC_ERROR === '1') {
    throw Object.assign(new Error('Signing test RPC rejected'), { code: 3 });
  }
  return response;
}

CryptoBrokerClient.NewLibrary = async () => ({
  async signData(payload) {
    return respond('SignData', payload, {
      signature: Buffer.from('ab01', 'hex'),
    });
  },
  async verifyData(payload) {
    return respond('VerifyData', payload, {
      valid: payload.input.toString() === 'message',
    });
  },
});
