import { IAccount } from "../../src/interfaces/IAccount";
import { IContractData } from "../../src/interfaces/IContractData";
import { SmartContractUtils } from "@massalabs/massa-sc-utils";
import { PathLike } from "fs";
import { Client } from "../../src/web3/Client";
import { ICompiledSmartContract } from "@massalabs/massa-sc-utils/dist/interfaces/ICompiledSmartContract";
import { EOperationStatus } from "../../src/interfaces/EOperationStatus";
const chalk = require("chalk");

export const deploySmartContract = async (wasmFile: PathLike,
							contractData: IContractData,
							web3Client: Client,
							awaitFinalization: boolean,
							deployerAccount?: IAccount): Promise<string> => {

	let deploymentOperationId: string;
	try {

		// do checks
		if (!deployerAccount) {
			deployerAccount = web3Client.wallet().getBaseAccount();
		}

		// set default values in case of missing ones
		contractData.maxGas = contractData.maxGas || 200000;
		contractData.fee = contractData.fee || 0;
		contractData.gasPrice = contractData.gasPrice || 0;
		contractData.coins = contractData.coins || 0;

		// construct a sc utils helper
		const utils = new SmartContractUtils();

		// compile sc from wasm file ready for deployment
		console.log(`Running ${chalk.green("compilation")} of smart contract on path ${chalk.yellow(wasmFile)}....`);
		let compiledSc: ICompiledSmartContract;
		try {
			compiledSc = await utils.compileSmartContractFromWasmFile(wasmFile);
			console.log(`Smart Contract ${chalk.green("successfully")} compiled to deployable bytecode under ${wasmFile}`);
		} catch (ex) {
			const msg = chalk.red(`Error compiling smart contract on path ${chalk.yellow(wasmFile)}`);
			console.error(msg);
			throw new Error(ex);
		}

		if (!compiledSc.base64) {
			const msg = chalk.red(`No bytecode to deploy for wasm file ${chalk.yellow(wasmFile)}. Check AS compiler`);
			console.error(msg);
			throw new Error(msg);
		}

		contractData.contractDataBase64 = compiledSc.base64;
		contractData.contractDataBinary = compiledSc.binary;
		contractData.contractDataText = compiledSc.text;

		// deploy smart contract
		console.log(`Running ${chalk.green("deployment")} of smart contract....`);
		let deployTxId: string[] = [];

		try {
			deployTxId = await web3Client.smartContracts().deploySmartContract(contractData, deployerAccount);
			if (deployTxId.length === 0) {
				throw new Error(`No transaction ids were produced by the deployment. Something went wrong. Please check your contract and network`);
			}
			deploymentOperationId = deployTxId[0];
			console.log(`Smart Contract ${chalk.green("successfully")} deployed to Massa Network. Operation ID ${chalk.yellow(deploymentOperationId)}`);
		} catch (ex) {
			const msg = chalk.red(`Error deploying smart contract ${chalk.yellow(wasmFile)} to Massa Network`);
			console.error(msg);
			throw new Error(ex);
		}

		// await final state
		if (awaitFinalization) {
			console.log(`Awaiting ${chalk.green("FINAL")} transaction status....`);
			let status: EOperationStatus;
			try {
				status = await web3Client.smartContracts().awaitRequiredOperationStatus(deploymentOperationId, EOperationStatus.FINAL);
				console.log(`Transaction with Operation ID ${chalk.yellow(deploymentOperationId)} has reached finality!`);
			} catch (ex) {
				const msg = chalk.red(`Error getting finality of transaction ${chalk.yellow(deploymentOperationId)}`);
				console.error(msg);
				throw new Error(ex);
			}

			if (status !== EOperationStatus.FINAL) {
				const msg = chalk.red(`Transaction ${chalk.yellow(deploymentOperationId)} did not reach finality after considerable amount of time. Try redeploying anew`);
				console.error(msg);
				throw new Error(msg);
			}
		}
	} catch (ex) {
		const msg = chalk.red(`Error deploying smart contract ${chalk.yellow(wasmFile)} to Massa Network`);
		console.error(msg);
		throw new Error(ex);
	}
	console.log(`Smart Contract Deployment finished!`);

	return deploymentOperationId;
};
