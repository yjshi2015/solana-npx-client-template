import { initializeKeypair } from "./initializeKeypair"
import * as web3 from "@solana/web3.js"
import * as token from '@solana/spl-token'



// step 1: 创建铸币厂
async function createNewMint(
  connection: web3.Connection,
  payer: web3.Keypair,
  mintAuthority: web3.PublicKey,
  freezeAuthoritty: web3.PublicKey,
  decimals: number
): Promise<web3.PublicKey> {

  const tokenMint = await token.createMint(
    connection,
    payer,
    mintAuthority,
    freezeAuthoritty,
    decimals
  );
  return tokenMint;
}

// step 2:创建 token account，可以为某个owner创建 N个 token account，但为了简化，这里我们只创建 owner 的 ata 账户
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  console.log(`开始创建ata账户`)
  // todo syj 2调用函数开始等待
  // console.log(`sleep begin.....`)
  // await sleep(15);
  // console.log(`sleep finished.....`)

  // 这里其实是个 ATA 账户
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )
  console.log(`完成创建ata账户`)
  return tokenAccount
}

// step 3:开始铸币
async function mintTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  destination: web3.PublicKey,
  authority: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.mintTo(
    connection,
    payer,
    mint,
    destination,
    authority,
    amount
  )

  return transactionSignature
}

// step 4: 给指定账户授权
async function approveDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  delegate: web3.PublicKey,
  owner: web3.Signer | web3.PublicKey,
  amount: number) {

  const transactionSignature = await token.approve(
    connection,
    payer,
    account,
    delegate,
    owner,
    amount
  )

  return transactionSignature
}

// step 5: 转移token
async function transferTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  source: web3.PublicKey,
  destination: web3.PublicKey,
  owner: web3.Keypair,
  amount: number
) {
  const transactionSignature = await token.transfer(
    connection,
    payer,
    source,
    destination,
    owner,
    amount
  )
  return transactionSignature

}

// step 6: 移除授权
async function removeDelegate(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  owner: web3.PublicKey | web3.Signer) {

  const transactionSignature = await token.revoke(
    connection,
    payer,
    account, //需要移除授权的 token account
    owner // 该 token account 的 owner 所有者
  )
  return transactionSignature
}

// step 7: 销毁 token account
async function burnTokens(
  connection: web3.Connection,
  payer: web3.Keypair,
  account: web3.PublicKey,
  mint: web3.PublicKey,
  owner: web3.Keypair,
  amount: number) {

  const transactionSignature = await token.burn(
    connection,
    payer,
    account,
    mint,
    owner,
    amount
  )
  return transactionSignature

}

// async function main() {
//   console.log(`--------------- Solana Token Swap ---------------`);
//   const connection = new web3.Connection(web3.clusterApiUrl("devnet"))
//   const user = await initializeKeypair(connection)
//   console.log(`user: ${user.publicKey}`)
// }

async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"), "confirmed")

  // 它拥有铸币厂的铸币权、冻结权、ATA 账户的所有权
  const user = await initializeKeypair(connection)
  console.log(`step1: 我的钱包地址 wallet: ${user.publicKey}`)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )
  console.log(`step2: 铸币厂地址 token mint ${mint}`);
  console.log(`step2: 创建铸币厂交易签名 https://explorer.solana.com/address/${mint}?cluster=devnet`);


  // todo syj 1调用函数开始等待
  await sleep(5);
  console.log(`sleep finished.....`)


  const mintInfo = await token.getMint(connection, mint);
  console.log(`step3: 查询铸币厂信息 mintInfo : ${JSON.stringify(mintInfo.address)}`);

  // 这是个ata账户
  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,// 铸币厂
    user.publicKey // token account 的拥有者
  )

  console.log(`step4: 钱包对应的ATA 账户是: ${tokenAccount.address}`);
  console.log(`step4: 创建 ATA 账户的交易签名: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`);

  const mintTokenTx = await mintTokens(
    connection,
    user,//支付交易费
    mint,//铸币厂
    tokenAccount.address,//铸币目标地址，是token account，前一步的 ATA 账户
    user,//拥有铸币权的人
    100 * 10 ** mintInfo.decimals  // 100 token
  )
  console.log(`step5: 给 ATA 账户 ${tokenAccount.address} 铸造 100 个Token, 交易签名 https://explorer.solana.com/tx/${mintTokenTx}?cluster=devnet`);

  const delegate = web3.Keypair.generate();
  console.log(`step6: delegate 授权账户: ${delegate.publicKey}`);

  const delegateTx = await approveDelegate(
    connection,
    user,//支付交易费
    tokenAccount.address, //拥有token的账户
    delegate.publicKey, // 被授权的用户
    user.publicKey, // token account 的拥有者，token account 要授权你还得让你的 owner 同意，哈哈
    50 * 10 ** mintInfo.decimals // 50 token
  )
  console.log(`step7: ATA 账户${tokenAccount.address} 给 delegate账户 ${delegate.publicKey} 授权 50 个token, 交易签名 https://explorer.solana.com/tx/${delegateTx}?cluster=devnet`);

  const receiver = web3.Keypair.generate().publicKey
  console.log(`step8: receiver 接收者账户: ${receiver}`);

  // 这也是个ata账户
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )
  console.log(`step9: 接收者对应的ATA 账户是: ${receiverTokenAccount.address}`);
  console.log(`step9: 创建 ATA 账户的交易签名: https://explorer.solana.com/address/${receiverTokenAccount.address}?cluster=devnet`);

  // tokenAccount 的 owner 为什么是 delegate 账户？？？
  const transactionTx = await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )
  console.log(`step10: 账户 ${tokenAccount.address} 通过授权账户 ${delegate.publicKey} 向 ${receiverTokenAccount.address} 转移 50 个token`);
  console.log(`step10: 转账交易: https://explorer.solana.com/tx/${transactionTx}?cluster=devnet`);

  // 移除授权
  const removeTx = await removeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  )
  console.log(`step11: 账户 ${tokenAccount.address} 移除了它的授权信息, 对应的交易信息: https://explorer.solana.com/tx/${removeTx}?cluster=devnet`);

  const burnTx = await burnTokens(
    connection,
    user,
    tokenAccount.address,
    mint,
    user,
    25 * 10 ** mintInfo.decimals
  )
  console.log(`step12: 账户 ${tokenAccount.address} 销毁了25个token, 对应的交易签名: https://explorer.solana.com/tx/${burnTx}?cluster=devnet`);
}

function sleep(seconds: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

main()
