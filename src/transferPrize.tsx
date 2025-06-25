// @ts-ignore
import Web3 from 'web3';
import {message} from 'antd';

const MONAD_CHAIN = {
    id: 10143,
    name: "Monad Testnet",
    network: "monad-testnet",
    nativeCurrency: {name: "Monad", symbol: "MON", decimals: 18},
    rpcUrls: {default: {http: ["https://testnet-rpc.monad.xyz"]}},
    blockExplorers: {default: {name: "MonadExplorer", url: "https://testnet.monadexplorer.com"}},
};
const web3 = new Web3(MONAD_CHAIN.rpcUrls.default.http[0]);
const poolAddress = '0x2696F69fF39801191A17A4bD1F5658974B8F496D';  // 您的奖池地址

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
