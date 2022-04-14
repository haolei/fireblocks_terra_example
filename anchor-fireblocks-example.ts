import {AnchorEarn, CHAINS, DENOMS, NETWORKS} from "@anchor-protocol/anchor-earn";
import {LCDClient, Fee, SignatureV2, PublicKey, SimplePublicKey, TxAPI} from "@terra-money/terra.js";
import {FireblocksSDK, TransactionOperation} from "fireblocks-sdk";
import * as fs from "fs";

(async () => {
  // your secret to acess fireblocks, you need secret_key.txt in current directory
  const secret = fs.readFileSync("secret_key.txt", "utf8").toString();
  const fb = new FireblocksSDK(secret, "2399a3ce-fce0-5c98-9321-7d95b2c0136d");
  // const account = await fb.getVaultAccountById('820');

  const address: string = "terra1zf8hjvuew3u99uj48a9j90xl7m4w9qd6zhz2la";

  const lcd = new LCDClient({
    chainID: "bombay-12",
    URL: "https://bombay-lcd.terra.dev",
  });
  const txApi = new TxAPI(lcd);

  const anchor = new AnchorEarn({
    chain: CHAINS.TERRA,
    network: NETWORKS.BOMBAY_12,
    address: address,
  });

  const depositResult = await anchor.deposit({
    amount: "1",
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
      console.log(`start to sign tx with fireblocks`);

      const txCreateResult = await fb.createTransaction({
        operation: TransactionOperation.RAW,
        extraParameters: {
          rawMessageData: {
            algorithm: "MPC_ECDSA_SECP256K1",
            messages: [
              {
                content: unsignedTxBuffer,

                // or your own derivation path, matching with the address
                derivationPath: [330, 1, 820, 0, 0],
              },
            ],
          },
        },
      });

      console.log(`signed data is ${txCreateResult}`);

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
