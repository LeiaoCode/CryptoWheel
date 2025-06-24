// @ts-ignore
import Web3 from 'web3';
import {message} from 'antd';

// 配置 Monad Testnet 网络
const MONAD_CHAIN = {
    id: 10143,
    name: "Monad Testnet",
    network: "monad-testnet",
    nativeCurrency: {name: "Monad", symbol: "MON", decimals: 18},
    rpcUrls: {default: {http: ["https://testnet-rpc.monad.xyz"]}},
    blockExplorers: {default: {name: "MonadExplorer", url: "https://testnet.monadexplorer.com"}},
};

// 初始化 Web3 实例，连接到 Monad Testnet
const web3 = new Web3(MONAD_CHAIN.rpcUrls.default.http[0]);

// 奖池私钥（请注意：在前端暴露私钥是不安全的，生产环境中应当避免这样做）
const poolPrivateKey = "0x8585f11c210d70a1c0b1bc6c86ce1f250e89eece2b44109fed48f41a70a5d9bc";  // 请替换为奖池钱包的私钥
// const poolAddress = '0x82Bed6403df3639A8BB2C1EA621439D2ab56Bc99';  // 您的奖池地址
const poolAddress = '0x2696F69fF39801191A17A4bD1F5658974B8F496D';  // 您的奖池地址

// 转账函数
export const transferPrize = async (winnerAddress: string, prizeAmount: number) => {
    if (!winnerAddress || prizeAmount <= 0) {
        message.error("无效的中奖地址或金额");
        return;
    }

    try {
        // 获取平台钱包（奖池钱包）的地址
        const account = web3.eth.accounts.privateKeyToAccount(poolPrivateKey);

        // 获取当前网络的 gas 价格
        const gasPrice = await web3.eth.getGasPrice();

        // 获取奖池余额，确保余额足够支付
        const balance = await web3.eth.getBalance(account.address);
        if (parseFloat(web3.utils.fromWei(balance, 'ether')) < prizeAmount) {
            message.error("奖池余额不足，无法支付奖金");
            return;
        }

        // 创建交易数据
        const transaction = {
            from: account.address,               // 奖池地址（发送方）
            to: winnerAddress,                   // 中奖者地址（接收方）
            value: web3.utils.toWei(prizeAmount.toString(), 'ether'),  // 转账金额（单位：MON，按 18 位小数表示）
            gas: 2000000,                         // 默认 gas 限制
            gasPrice: gasPrice,                   // 使用实时 gas 价格
        };

        // 签署交易
        const signedTransaction = await web3.eth.accounts.signTransaction(transaction, poolPrivateKey);

        // 发送已签名的交易
        const receipt = await web3.eth.sendSignedTransaction(signedTransaction.rawTransaction);

        message.success(`成功转账 ${prizeAmount} MON 给中奖者！`);
        console.log("Transaction receipt:", receipt);  // 输出交易回执

        return receipt.transactionHash;  // 返回交易回执

    } catch (error) {
        console.error("转账失败", error);
        message.error("转账失败，请重试");
    }
};


// 奖池地址

// 获取奖池的 MON 余额
export const getPoolBalance = async () => {
    try {
        // 获取奖池地址的余额
        const balance = await web3.eth.getBalance(poolAddress);

        // 将余额转换为 MON 单位（假设 MON 是 ERC20 代币，并且使用 18 位小数）
        const balanceInMon = web3.utils.fromWei(balance, 'ether');
        return parseFloat(balanceInMon);  // 将返回值转换为数字
    } catch (error) {
        console.error("获取奖池余额失败:", error);
        return 0;  // 如果发生错误，返回 0
    }
};
