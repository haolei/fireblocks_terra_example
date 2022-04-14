import {AnchorEarn, CHAINS, DENOMS, NETWORKS} from "@anchor-protocol/anchor-earn";
import {LCDClient, Fee, SignatureV2, PublicKey, SimplePublicKey, TxAPI} from "@terra-money/terra.js";
import {FireblocksSDK, TransactionOperation} from "fireblocks-sdk";
import * as fs from "fs";

(async () => {
  // your secret to acess fireblocks, you need secret_key.txt in current directory
  const secret = fs.readFileSync("secret_key.txt", "utf8").toString();
  const fb = new FireblocksSDK(secret, "<fb key>");
  // const accountId = "0"; // some number

  // const accounts = await fb.getVaultAccounts();
  const address: string = "fireblocks_account_TO_BE_REPLACED";

  const lcd = new LCDClient({
    chainID: "tequila-0004",
    URL: "https://tequila-lcd.terra.dev",
  });
  const txApi = new TxAPI(lcd);

  const anchor = new AnchorEarn({
    chain: CHAINS.TERRA,
    network: NETWORKS.COLUMBUS_5,
    address: address,
  });

  const depositResult = await anchor.deposit({
    amount: "100000",
    currency: DENOMS.UST,
    customSigner: async (msgs) => {
      // create unsigned tx
      const tx = await txApi.create(
        [
          {
            address: address,
          },
        ],
        {
          msgs: msgs,
          fee: new Fee(1000000, "0.15uusd"),
        }
      );

      //print tx body
      console.log(JSON.stringify(tx.body));
      // take hex version of unsigned tx
      const unsignedTxBuffer = Buffer.from(tx.body.toBytes());

      // toss this buffer around for signing
      const txCreateResult = await fb.createTransaction({
        operation: TransactionOperation.RAW,
        extraParameters: {
          rawMessageData: {
            algorithm: "MPC_ECDSA_SECP256K1",
            messages: [
              {
                content: unsignedTxBuffer,

                // or your own derivation path, matching with the address
                derivationPath: [44, 330, 0, 0, 0],
              },
            ],
          },
        },
      });

      // do the signing...

      // get tx result after all signing process is done
      const txResult = await fb.getTransactionById(txCreateResult.id);

      // append signatures to stdTx
      txResult.signedMessages?.forEach((signedMessage) => {
        tx.appendSignatures([
          SignatureV2.fromAmino({
            signature: signedMessage.signature.fullSig,
            pub_key: new SimplePublicKey(signedMessage.publicKey).toAmino(),
          }),
        ]);
      });

      // return signed tx
      return tx;
    },
  });

  // inspect the result
  console.log(depositResult);
})();
