import { Args, bytesToStr, strToBytes, U256 } from '../basicElements'
import { Operation } from '../operation'
import { Provider } from '../provider'
import { CallSCOptions, ReadSCOptions, SmartContract } from '../smartContracts'
import { checkNetwork } from './tokens'

export const MNS_CONTRACTS = {
  mainnet: 'AS1q5hUfxLXNXLKsYQVXZLK7MPUZcWaNZZsK7e9QzqhGdAgLpUGT',
  buildnet: 'AS12qKAVjU1nr66JSkQ6N4Lqu4iwuVc6rAbRTrxFoynPrPdP1sj3G',
}

/**
 * @class MNS
 * @extends SmartContract
 *
 * The MNS class provides methods to interact with the Massa Name Service (MNS) smart contract.
 * It allows resolving domain names, reverse resolving addresses, allocating domains, freeing domains,
 * and updating domain targets.
 * MNS contract is available here: https://github.com/massalabs/massa-name-service/blob/main/smart-contract/assembly/contracts/main.ts
 *
 * @example
 * ```typescript
 * const mns = await MNS.mainnet(provider);
 * const address = await mns.resolve("example");
 * ```
 *
 */

export class MNS extends SmartContract {
  static async mainnet(provider: Provider): Promise<MNS> {
    checkNetwork(provider, true)
    return new MNS(provider, MNS_CONTRACTS.mainnet)
  }

  static async buildnet(provider: Provider): Promise<MNS> {
    checkNetwork(provider, false)
    return new MNS(provider, MNS_CONTRACTS.buildnet)
  }

  // Resolve domain name (without "".massa") to address
  async resolve(name: string, options?: ReadSCOptions): Promise<string> {
    const res = await this.read(
      'dnsResolve',
      new Args().addString(name),
      options
    )
    return bytesToStr(res.value)
  }

  async fromAddress(
    address: string,
    options?: ReadSCOptions
  ): Promise<string[]> {
    const res = await this.read(
      'dnsReverseResolve',
      new Args().addString(address),
      options
    )
    return bytesToStr(res.value).split(',')
  }

  async alloc(
    name: string,
    owner: string,
    options?: CallSCOptions
  ): Promise<Operation> {
    return this.call(
      'dnsAlloc',
      new Args().addString(name).addString(owner),
      options
    )
  }

  private async getTokenId(name: string): Promise<bigint> {
    // Constants are taken from the smart contract
    // https://github.com/massalabs/massa-name-service/blob/476189525c00d189f8914627abf82b8fdf144c6e/smart-contract/assembly/contracts/main.ts#L64
    // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-magic-numbers
    const [DOMAIN_SEPARATOR_KEY, TOKEN_ID_KEY_PREFIX] = [0x42, 0x01]
    const key = Uint8Array.from([
      DOMAIN_SEPARATOR_KEY,
      TOKEN_ID_KEY_PREFIX,
      ...strToBytes(name),
    ])
    const data = await this.provider.readStorage(this.address, [key], true)
    if (!data.length) {
      throw new Error(`Domain ${name} not found`)
    }
    return U256.fromBytes(data[0])
  }

  async free(name: string, options?: CallSCOptions): Promise<Operation> {
    const tokenId = await this.getTokenId(name)
    return this.call('dnsFree', new Args().addU256(tokenId), options)
  }

  async updateTarget(
    name: string,
    newTarget: string,
    options?: CallSCOptions
  ): Promise<Operation> {
    return this.call(
      'dnsUpdateTarget',
      new Args().addString(name).addString(newTarget),
      options
    )
  }
}
