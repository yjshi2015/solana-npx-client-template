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

  console.log(`The token mint account address is ${tokenMint}`);
  console.log(`Token Mint: https://explorer.solana.com/address/${tokenMint}?cluster=devnet`);

  return tokenMint;
}

// step 2:创建 token account，可以为某个owner创建 N个 token account，但为了简化，这里我们只创建 owner 的 ata 账户
async function createTokenAccount(
  connection: web3.Connection,
  payer: web3.Keypair,
  mint: web3.PublicKey,
  owner: web3.PublicKey
) {
  // 这里其实是个 ATA 账户
  const tokenAccount = await token.getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    owner
  )

  console.log(`Token Account（ATA）: https://explorer.solana.com/address/${tokenAccount.address}?cluster=devnet`);

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

  console.log(`Mint Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}

// step 4: 给指定账户授权
async function approveDelegate(
  connection:web3.Connection,
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

  console.log(`Approve Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
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

  console.log(`Transfer Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
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

    console.log(`Remove Delegate Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
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

    console.log(`Burn Transaction: https://explorer.solana.com/tx/${transactionSignature}?cluster=devnet`);
}


async function main() {
  const connection = new web3.Connection(web3.clusterApiUrl("devnet"))

  // 它拥有铸币厂的铸币权、冻结权、ATA 账户的所有权
  const user = await initializeKeypair(connection)

  const mint = await createNewMint(
    connection,
    user,
    user.publicKey,
    user.publicKey,
    2
  )

  const mintInfo = await token.getMint(connection, mint);

  // 这是个ata账户
  const tokenAccount = await createTokenAccount(
    connection,
    user,
    mint,// 铸币厂
    user.publicKey // token account 的拥有者
  )

  await mintTokens(
    connection,
    user,//支付交易费
    mint,//铸币厂
    tokenAccount.address,//铸币目标地址，是token account，前一步的 ATA 账户
    user,//拥有铸币权的人
    100 * 10 ** mintInfo.decimals  // 100 token
  )

  const delegate = web3.Keypair.generate();

  await approveDelegate(
    connection,
    user,//支付交易费
    tokenAccount.address, //拥有token的账户
    delegate.publicKey, // 被授权的用户
    user.publicKey, // token account 的拥有者，token account 要授权你还得让你的 owner 同意，哈哈
    50 * 10 ** mintInfo.decimals // 50 token
  )

  const receiver = web3.Keypair.generate().publicKey
  // 这也是个ata账户
  const receiverTokenAccount = await createTokenAccount(
    connection,
    user,
    mint,
    receiver
  )

  // tokenAccount 的 owner 为什么是 delegate 账户？？？
  await transferTokens(
    connection,
    user,
    tokenAccount.address,
    receiverTokenAccount.address,
    delegate,
    50 * 10 ** mintInfo.decimals
  )

  // 移除授权
  await removeDelegate(
    connection,
    user,
    tokenAccount.address,
    user.publicKey,
  )

  await burnTokens(
    connection,
    user,
    tokenAccount.address,
    mint,
    user,
    25 * 10 ** mintInfo.decimals
  )
}