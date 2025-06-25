import React, {useState, useMemo, useEffect, memo, useRef} from "react";
import {
    Layout,
    Button,
    Card,
    Typography,
    message,
    Tabs,
    Input,
    List,
    Space,
    ConfigProvider,
    theme,
    Table,
    Progress,
    Tag, Avatar, Divider,
} from "antd";
import {HighlightOutlined} from "@ant-design/icons";
import {ConnectButton, Address, Connector} from "@ant-design/web3";
import {MetaMask, OkxWallet, WagmiWeb3ConfigProvider, WalletConnect} from "@ant-design/web3-wagmi";
import {useAccount, createConfig, http, useSendTransaction} from "wagmi";
import {useStateTogether} from "react-together";
// @ts-ignore
import {LuckyWheel} from '@lucky-canvas/react'
import "./ChatPanel.css";
import {parseEther} from "viem";
import {getPoolBalance} from "./transferPrize";

const MONAD_CHAIN = {
    id: 10143,
    name: "Monad Testnet",
    network: "monad-testnet",
    nativeCurrency: {name: "Monad", symbol: "MON", decimals: 18},
    rpcUrls: {default: {http: ["https://testnet-rpc.monad.xyz"]}},
    blockExplorers: {default: {name: "MonadExplorer", url: "https://testnet.monadexplorer.com"}},
} as const;
const wagmiConfig = createConfig({
    chains: [MONAD_CHAIN],
    transports: {[MONAD_CHAIN.id]: http()},
});
type Message = {
    id: number;       // 消息的唯一ID
    sender: string;   // 发送者地址
    text: string;     // 消息内容
    ts: string;       // 消息时间戳
};

const {Header, Content, Footer} = Layout;
const {Title, Text} = Typography;

// 为表格列添加点击复制功能
const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
        .then(() => message.success('已复制到剪贴板'))
        .catch(() => message.error('复制失败'));
};
// 转盘抽奖
// 转盘抽奖记录
type PrizeRecord = {
    id: string;               // 唯一标识符
    address: string;          // 支付地址
    amount: number;          // 支付金额
    hash: string;          // 支付hash
    prize: string;            // 中奖金额或奖品
    timestamp: string;        // 中奖时间戳
    isClaimed: boolean;       // 是否已兑奖 (true/false)
    claimTimestamp: string;   // 兑奖时间戳
    claimTxHash: string;      // 兑换 MON 的转账哈希
};


type Ticket = {
    address: string;
    hash: string;
    ticketCount: number;
    timestamp: string;
};
type PaymentRecord = {
    address: string;
    amount: number;
    hash: string;
    timestamp: string;
};
const WheelOfFortune = memo(({address}: { address: string | null }) => {
    // 中奖记录
    const [latestPrizes, setLatestPrizes] = useStateTogether<PrizeRecord[]>("latestPrize", []);
    // 购票记录
    // @ts-ignore
    const [ticket, setTicket] = useStateTogether<Ticket[]>("ticket", []);
    // 支付记录
    const [paymentRecord, setPaymentRecord] = useStateTogether<PaymentRecord[]>("paymentRecord", []);
    // 奖池记录
    const [poolBalance, setPoolBalance] = useStateTogether<number>('poolBalance', 30); // 初始为 30
    // 转账额度
    const [ticketPrice, setTicketPrice] = useStateTogether<number>('ticketPrice', 2.25); // 初始为 2.25
    const [amount, setAmount] = useState<number>(0); // 初始为 2.25
    // 转盘记录
    const [prize, setPrize] = useStateTogether<any>('prize', [
        {background: "#e9e8fe", fonts: [{text: "0.50 MON"}]},
        {background: "#e9e8fe", fonts: [{text: "1.00 MON"}]},
        {background: "#e9e8fe", fonts: [{text: "2.00 MON"}]},
        {background: "#e9e8fe", fonts: [{text: "2.50 MON"}]},
        {background: "#e9e8fe", fonts: [{text: "2.00 MON"}]},
        {background: "#e9e8fe", fonts: [{text: "2.00 MON"}]}
    ]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [signHash, setSignHash] = useState<string>('');
    const {sendTransactionAsync} = useSendTransaction();
    const myLucky = useRef(null);
    const audioRef = useRef<HTMLAudioElement>(null); // 引用音频播放器
    const columns = [
        {
            title: "抽奖地址",
            dataIndex: "address",
            key: "address",
            width: 200,
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0, cursor: "pointer"}} onClick={() => handleCopy(text)}>
                    {text.slice(0, 6)}...{text.slice(-5)}
                </Tag>
            ),
            align: 'center' as 'center',
        },
        {
            title: "抽奖结果",
            dataIndex: "prize",
            key: "prize",
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0}}>
                    {text}
                </Tag>
            ),
            width: 200,
            align: 'center' as 'center',
        },
        {
            title: "时间",
            dataIndex: "timestamp",
            key: "timestamp",
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0}}>
                    {text}
                </Tag>
            ),
            width: 200,
            align: 'center' as 'center',
        },
    ];

    // 总额变化则更新转盘数据和重新查询奖池余额
    useEffect(() => {
        console.log('获取奖池余额并设置状态')

        const new_prize = generatePrizes(poolBalance / 3);
        setPrize(new_prize)

        const fetchPoolBalance = async () => {
            const balance = await getPoolBalance();
            console.log('金额', balance)
            setPoolBalance(balance);
        };
        fetchPoolBalance()
    }, [poolBalance]);


    // 转盘数据变化则更新购票金额
    useEffect(() => {
        const paymentAmount = calculatePaymentAmount();
        setTicketPrice(paymentAmount)
    }, [prize]);

    // 支付处理
    const runPay = async () => {
        if (poolBalance <= 1) {
            message.error("当前奖池小于1个MON，无法进行抽奖！");
            return;
        }

        setIsLoading(true);
        if (!address) {
            message.warning("请连接钱包参与抽奖");
            return;
        }

        try {
            const sign = await sendTransactionAsync({
                to: "0x2696f69ff39801191a17a4bd1f5658974b8f496d",
                value: parseEther(ticketPrice.toString()),
            });
            setSignHash(sign)
            // 保存票据
            const newEntry = {
                address: address!,
                hash: sign,
                ticketCount: 1,
                timestamp: new Date().toLocaleString(),
            };
            setTicket((prev: Ticket[]) => {
                const updatedTickets = [...prev];
                const existingTicketIndex = updatedTickets.findIndex(t => t.address === address);
                if (existingTicketIndex !== -1) {
                    updatedTickets[existingTicketIndex].ticketCount += 1;
                } else {
                    updatedTickets.push(newEntry);
                }
                return updatedTickets;
            });
            message.success("购买抽奖票成功！");

            const payment: PaymentRecord = {
                address: address!,
                hash: sign,
                amount: ticketPrice,
                timestamp: new Date().toLocaleString(),
            };
            setAmount(ticketPrice)
            setPaymentRecord([payment, ...paymentRecord]);

            // 触发 LuckyWheel 组件的转盘
            if (myLucky.current) {
                playSound();
                // @ts-ignore
                myLucky.current.play(); // 调用 LuckyWheel 组件的 play 方法，开始转盘
            }
            setTimeout(async () => {
                const index = Math.random() * 6 >> 0
                // @ts-ignore
                myLucky.current.stop(index)
            }, 6500)

        } catch (error) {
            console.error("支付失败", error);
            message.error("支付失败，请重试");
        } finally {
            setIsLoading(false);
        }
    };

    // 动态生成奖项并与奖池关联，确保奖项总金额不超过 5 MON
    const generatePrizes = (maxPrizeAmount: number) => {
        const percentages = [0.05, 0.10, 0.20, 0.25, 0.20, 0.20];  // 设定6个奖项的百分比
        const prizes = percentages.map(percentage => {
            // 计算每个奖项金额
            const prizeAmount = percentage * maxPrizeAmount;
            return {background: "#e9e8fe", fonts: [{text: `${prizeAmount.toFixed(2)} MON`}]};
        });
        return prizes;
    };

    // 计算支付金额，支付金额为三分之一奖池的六份的中间值
    const calculatePaymentAmount = () => {
        const prizes = prize;  // 使用百分比生成奖项金额
        // @ts-ignore
        prizes.sort((a, b) => parseFloat(a.fonts[0].text) - parseFloat(b.fonts[0].text));  // 按金额排序
        // 获取第3个和第4个奖项的平均值作为支付金额
        const paymentAmount = (parseFloat(prizes[2].fonts[0].text) + parseFloat(prizes[3].fonts[0].text)) / 2;
        return paymentAmount;
    };


    // 抽奖并更新奖池
    const spinWheelSave = async (prize: any) => {
        setPoolBalance(prevBalance => prevBalance + amount); // 增加奖池余额
        if (!address) {
            await message.warning("请连接钱包参与抽奖");
            return;
        }
        const prizeResult = prize.fonts[0].text;
        const prizeAmount = parseFloat(prizeResult.split(" ")[0]);
        // 减去奖池
        if (prizeAmount) {
            setPoolBalance(prevBalance => Math.max(prevBalance - prizeAmount, 0));
        }

        // 修改票据
        setTicket((prev: Ticket[]) => {
            const updatedTickets = [...prev];
            const userTicket = updatedTickets.find(t => t.address === address);
            if (userTicket && userTicket.ticketCount > 0) {
                userTicket.ticketCount -= 1;
            }
            return updatedTickets;
        });

        message.success(`恭喜你抽中了：${prizeResult}`);

        await to_transferPrize(address, prizeAmount, prizeResult)
    };
    // const to_trans = async () => {
    //     await to_transferPrize(typeof address === "string" ? address : '123', 0.01, '0.01 MON')
    // }

    const generateUniqueId = () => {
        return new Date().toISOString();  // 使用当前时间戳作为唯一ID
    };

    // 成功之后实时转账给中间用户
    const to_transferPrize = async (address: string, prizeAmount: number, prizeResult: string) => {
        // 生成唯一的ID
        const id = generateUniqueId();

        // 创建中奖记录
        const record: PrizeRecord = {
            id: id,                      // 赋予唯一ID
            address: address,
            amount: amount,          // 支付金额
            hash: signHash,          // 支付hash
            prize: prizeResult,
            timestamp: new Date().toLocaleString(),
            isClaimed: false,
            claimTimestamp: '',          // 初始时没有兑奖时间
            claimTxHash: '',             // 初始时没有转账哈希
        };

        console.log('中奖记录', record);

        // 保存中奖记录
        setLatestPrizes((prev: PrizeRecord[]) => [record, ...prev]);

        try {
            // 使用 fetch 发起 HTTP 请求，调用 Vercel 部署的 API
            const response = await fetch('https://crypto-wheel-backend.vercel.app/api/transferPrize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
                body: JSON.stringify({
                    winnerAddress: address,
                    prizeAmount: prizeAmount,
                }),
            });
            // 如果请求成功，解析 JSON 响应
            const result = await response.json();

            if (result.success) {
                const receipt = result.transactionHash;  // 获取交易哈希

                // 如果转账成功，更新中奖记录为已兑奖，并记录转账哈希
                const updatedRecord: PrizeRecord = {
                    ...record,                  // 保留原始的中奖记录
                    isClaimed: true,            // 标记已兑奖
                    claimTimestamp: new Date().toLocaleString(),  // 设置兑奖时间为当前时间
                    claimTxHash: receipt,  // 存储转账的哈希值
                };

                // 根据唯一ID更新中奖记录
                setLatestPrizes((prev: PrizeRecord[]) =>
                    prev.map(item => item.id === id ? updatedRecord : item)
                );

                message.success('自动兑换奖金成功');
            } else {
                // 处理转账失败的情况
                console.error(`转账失败: ${result.message}`);
            }

        } catch (error) {
            // 处理转账失败的情况
            console.error("转账失败", error);
            console.error("转账失败，请重试");
        } finally {
            const balance = await getPoolBalance();
            setPoolBalance(balance);
            message.success('刷新去中心化数据成功!');
        }
    };
    // 播放音效
    const playSound = () => {
        if (audioRef.current) {
            audioRef.current.play().catch(err => {
                console.error("播放音效失败", err);
            });
        }
    };

    return (
        <Card
            style={{
                padding: "24px",
                minHeight: "400px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                borderRadius: "16px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                color: "#fff",
                position: "relative" // 使得右上角的奖池显示可以覆盖在卡片内
            }}
        >
            {/* 显示奖池余额 */}
            <div style={{
                position: "absolute",
                top: "16px",
                right: "16px",
                padding: "8px 12px",
                backgroundColor: "#ff9a9e",
                borderRadius: "12px",
                color: "#fff",
                fontWeight: "bold"
            }}>
                当前奖池: {poolBalance.toFixed(2)} MON
            </div>

            {/* 音频文件 */}
            <audio ref={audioRef} src="./a.mp3" preload="auto"/>

            <div style={{marginTop: "20px"}}>
                <Button
                    type="primary"
                    icon={<HighlightOutlined/>}
                    block
                    style={{
                        marginBottom: "12px",
                        borderRadius: "30px",
                        fontWeight: "bold",
                        backgroundColor: "#ffffff",
                        color: "#4e8bf1",
                        borderColor: "#ffffff",
                    }}
                    disabled={!address || isLoading}
                    onClick={runPay}
                >
                    {isLoading ? "支付中..." : `每张抽奖票需要支付 ${ticketPrice} MON`}
                </Button>
            </div>

            <div style={{display: "flex", justifyContent: "center", alignItems: "center"}}>
                <LuckyWheel
                    ref={myLucky}
                    width="400px"
                    height="300px"
                    // blocks={[{padding: "10px", background: "#869cfa"}]}
                    blocks={[
                        {
                            padding: "12px",
                            background: "#1651df",  // 炫酷渐变背景
                            borderRadius: "80%", // 圆形转盘
                            boxShadow: "0 4px 15px rgba(0, 0, 0, 0.3)", // 增加转盘阴影
                            transform: "scale(0.95)", // 缩小转盘大小，让奖项更集中
                        }
                    ]}
                    prizes={generatePrizes(poolBalance / 3)}
                    buttons={[
                        {radius: "50%", background: "#617df2"},
                        {radius: "40%", background: "#617df2"},
                        {radius: "35%", background: "#afc8ff"},
                        {radius: "30%", background: "#869cfa", pointer: true, fonts: [{text: "抽奖", top: "-10px"}]},
                    ]}
                    onStart={() => {
                        message.warning("支付成功之后自动抽奖");
                    }}
                    onEnd={(prize: any) => spinWheelSave(prize)}
                    style={{
                        borderRadius: "50%",
                        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.3)",  // 强化阴影效果
                        background: "linear-gradient(135deg, #ff5f6d, #ffc3a0)",  // 转盘渐变背景
                        border: "4px solid #fff",
                        display: "flex",
                        justifyContent: "center",  // 确保转盘居中
                        alignItems: "center",  // 确保转盘内容居中
                    }}
                    prizeStyle={{
                        fontSize: "16px",  // 调整字体大小
                        fontWeight: "bold", // 调整字体粗细
                        color: "#fff",  // 奖项字体颜色
                        textAlign: "center",  // 奖项内容居中显示
                        marginTop: "0",  // 调整奖项与转盘中心的距离
                        textShadow: "0 0 10px rgba(255, 255, 255, 0.8)"  // 文字阴影效果
                    }}
                />
            </div>
            {/*<div>*/}
            {/*    <Button*/}
            {/*        type="primary"*/}
            {/*        onClick={to_trans}*/}
            {/*    >*/}
            {/*        发送*/}
            {/*    </Button>*/}
            {/*</div>*/}

            <Divider plain style={{borderColor: "rgba(255, 255, 255, 0.3)", margin: "20px 0"}}/>

            <div>
                <Text strong style={{color: "#fff"}}>最近中奖记录：</Text>
                <Table
                    dataSource={latestPrizes.filter((item) => item.address === address)}
                    columns={columns}
                    size="small"
                    rowKey="timestamp"
                    scroll={{x: true, y: 500}}
                    locale={{
                        emptyText: <Text type="secondary">暂无抽奖记录</Text>,
                    }}
                    style={{
                        background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        backdropFilter: "blur(4px)",
                        borderRadius: "12px",
                        color: "#fff",
                    }}
                    tableLayout="fixed"
                    className="custom-table"
                />
            </div>
        </Card>
    );
});

// 聊天
interface ChatPanelProps {
    address: string | null;
}

const ChatPanel = memo(({address}: ChatPanelProps) => {
    const [messages, setMessages] = useStateTogether<Message[]>("messages", []);
    const [draft, setDraft] = React.useState<string>("");
    const canEdit = Boolean(address);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    // 自动滚动到底部
    const scrollToBottom = () => {
        setTimeout(() => {
            if (messagesEndRef.current && chatContainerRef.current) {
                chatContainerRef.current.scrollTop = messagesEndRef.current.offsetTop;
            }
        }, 50);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const send = () => {
        if (!canEdit) return alert("请连接钱包参与聊天");
        if (!draft.trim()) return;

        const msg: Message = {
            id: Date.now(),
            sender: address!,
            text: draft.trim(),
            ts: new Date().toISOString(),
        };

        // 始终只保留最新的 10 条消息
        setMessages((arr: Message[]) => [msg, ...arr]);
        setDraft("");
    };

    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        return date.toLocaleString([], {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    };


    return (
        <Card
            style={{
                padding: "24px",
                minHeight: "400px",  // 确保minHeight一致
                display: "flex",
                flexDirection: "column",
                background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                borderRadius: "16px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                color: "#fff",
            }}
        >
            {/* 聊天内容容器：最多显示10条，超出可滚动 */}
            <div ref={chatContainerRef} className="chat-messages-container" style={{flex: 1, overflowY: 'auto'}}>
                <List
                    dataSource={messages.slice().reverse()} // 最新的在最下面
                    renderItem={(item) => (
                        <List.Item key={item.id} className="chat-message-item">
                            <div
                                style={{
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '8px 0',
                                    justifyContent: item.sender === address ? 'flex-end' : 'flex-start',
                                }}
                            >
                                {/* 头像：显示发送者的首字母，使用背景色增强对比 */}
                                <Avatar
                                    style={{
                                        backgroundColor: item.sender === address ? '#00bfff' : '#bbb',
                                        fontSize: '14px',
                                        width: '32px',
                                        height: '32px',
                                        textAlign: 'center',
                                        lineHeight: '32px',
                                        display: item.sender === address ? 'none' : 'inline-block',
                                    }}
                                >
                                    {item.sender.slice(-2).toUpperCase()} {/* 头像显示发送者的最后两位字母 */}
                                </Avatar>

                                {/* 内容区域 */}
                                <div style={{flex: 1, maxWidth: '70%'}}>
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '6px'
                                    }}>
                                        {/* 发送者信息和时间戳 */}
                                        <Text
                                            strong
                                            style={{
                                                fontSize: '14px',
                                                fontWeight: '600',
                                            }}
                                        >
                                            {item.sender}
                                        </Text>
                                        <Text
                                            type="secondary"
                                            style={{
                                                fontSize: '12px',
                                                whiteSpace: 'nowrap',
                                            }}
                                        >
                                            {formatTime(item.ts)}
                                        </Text>
                                    </div>

                                    {/* 消息内容区域 */}
                                    <div
                                        className="message-content"
                                        style={{
                                            backgroundColor: item.sender === address ? 'linear-gradient(135deg, #007bff, #00bfff)' : '#f0f2f5',
                                            padding: '8px 12px',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.1)',
                                            wordWrap: 'break-word',
                                            lineHeight: '1.5',
                                            maxWidth: '100%',
                                        }}
                                    >
                                        {item.text}
                                    </div>
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
                <div ref={messagesEndRef}/>
            </div>

            {/* 输入框区域 */}
            <div style={{padding: "8px", justifyContent: "space-between", borderTop: "1px solid #e8e8e8",}}>
                <Space.Compact style={{width: "100%"}}>
                    <Input
                        value={draft}  // 确保输入框的值是受控的
                        onChange={(e) => setDraft(e.target.value)}
                        onPressEnter={(e) => {
                            if (!e.shiftKey) {
                                e.preventDefault();
                                send();
                            }
                        }}
                        placeholder={canEdit ? "输入聊天内容" : "请连接钱包来聊天"}
                        disabled={!canEdit}
                    />
                    <Button
                        type="primary"
                        onClick={send}
                        disabled={!canEdit || !draft.trim()}
                    >
                        发送
                    </Button>
                </Space.Compact>
            </div>
        </Card>
    );
});


const DecentralizedLotteryExplanation = () => {
    return (
        <Card
            style={{
                padding: "24px",
                minHeight: "400px",
                background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                borderRadius: "16px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                color: "#fff",
                overflowY: "auto"
            }}
        >
            <Text style={{color: "#fff", fontSize: "16px", lineHeight: "1.6"}}>
                <p><strong>欢迎参与我们的去中心化抽奖活动！</strong></p>
                <p style={{fontWeight: "bold", color: "#f86060"}}>
                    本平台采用 MultiSYNQ 进行前端开发，结合 Monad 网络提供的区块链支持，确保所有交易记录和抽奖结果的透明与不可篡改。
                    平台通过 Web3 技术实现与区块链的无缝连接，确保用户的支付、抽奖和奖池变动数据都可被实时查询和验证，从而保证公平性与安全性。
                </p>
                <p><strong>1. 参与方式</strong></p>
                <p>
                    - 用户通过支付 【MON】 代币来获得抽奖机会，每次支付的 【MON】 会加入到奖池中。
                    - 您需要通过钱包连接参与抽奖，确保钱包中有足够的 【MON】 代币。
                </p>

                <p><strong>2. 支付金额计算</strong></p>
                <p>
                    - 每次参与抽奖时，系统会动态计算用户需要支付的金额。支付金额是基于 【奖池的三分之一金额】
                    来计算的，确保支付金额处于公平范围。
                    - 支付金额会根据奖池的变化而 【动态调整】。
                </p>

                <p><strong>3. 奖池机制</strong></p>
                <p>
                    - 奖池的初始金额为 【30 MON】，每次用户支付的金额会 【增加奖池】，奖池越大，奖励金额越高。
                    - 奖池中的 【三分之一金额】 将作为本次抽奖的总奖励，分配为 6 个奖项，每个奖项的金额按比例分配。
                </p>

                <p><strong>4. 抽奖机制</strong></p>
                <p>
                    - 每次支付后，用户将立即触发抽奖，并且自动执行兑奖操作，无需额外手动兑奖。
                    - 转盘有 6 个奖项，奖项金额从小到大随机分配。中奖后，奖池金额会减少相应的金额。
                    - 用户有 【50%】 的机会 【赢得奖池金额】，但也有 【50%】 的机会 【亏损】，确保游戏公平性。
                </p>

                <p><strong>5. 自动化兑奖</strong></p>
                <p>
                    - 中奖后，系统会自动将奖品金额转入中奖者的账户，确保自动兑奖，无需人工干预。
                    - 所有的兑奖操作都会在区块链上自动执行，中奖后用户会立即收到奖品，无需等待。
                </p>

                <p><strong>6. 去中心化优势</strong></p>
                <p>
                    - 所有的数据都记录在 【区块链】 上，确保每一笔交易的 【透明性】 和 【可验证性】。
                    - 无需任何中心化的控制者，所有操作均由智能合约执行，确保公平且不可篡改。
                </p>

                <p><strong>7. 安全性与公平性</strong></p>
                <p>
                    - 由于系统完全去中心化，用户的支付、抽奖记录都 【公开透明】，并且无法被篡改或撤销。
                    - 所有用户的支付记录和中奖记录都可通过 【区块链浏览器】 查询，确保每个抽奖的公正性。
                </p>
            </Text>
        </Card>
    );
};


// 抽奖数据
const InfoPanel = () => {
    const [latestPrizes] = useStateTogether<PrizeRecord[]>("latestPrize", []);
    const [pageSize, setPageSize] = useState(10);  // 每页显示 5 行
    const [currentPage, setCurrentPage] = useState(1); // 当前页
    const [paginatedData, setPaginatedData] = useState<PrizeRecord[]>([]);

    useEffect(() => {
        // 计算分页数据
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = currentPage * pageSize;
        setPaginatedData(latestPrizes.slice(startIndex, endIndex));
    }, [latestPrizes, currentPage, pageSize]);

    const columns = [
        {
            title: "抽奖地址",
            dataIndex: "address",
            key: "address",
            width: 200,
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0, cursor: "pointer"}} onClick={() => handleCopy(text)}>
                    {text}
                </Tag>
            ),
            align: 'center' as 'center',
        },
        {
            title: "抽奖支付",
            dataIndex: "amount",
            key: "amount",
            width: 200,
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0, cursor: "pointer"}} onClick={() => handleCopy(text)}>
                    {text}
                </Tag>
            ),
            align: 'center' as 'center',
        },
        {
            title: "支付哈希",
            dataIndex: "hash",
            key: "hash",
            width: 200,
            render: (text: string) => (
                <Tag color="blue" style={{margin: 0}}>
                    {/* 如果有哈希值，创建可点击的链接，点击后跳转至区块链浏览器 */}
                    {text ? (
                        <a
                            href={`https://testnet.monadexplorer.com/tx/${text}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{color: '#1890ff'}}
                        >
                            {`${text.slice(0, 6)}...${text.slice(-4)}`}
                        </a>
                    ) : "暂无"}
                </Tag>
            ),
            align: 'center' as 'center',
        },
        {
            title: "抽奖结果",
            dataIndex: "prize",
            key: "prize",
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0}}>
                    {text}
                </Tag>
            ),
            width: 200,
            align: 'center' as 'center',
        },
        {
            title: "抽中时间",
            dataIndex: "timestamp",
            key: "timestamp",
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0}}>
                    {text}
                </Tag>
            ),
            width: 200,
            align: 'center' as 'center',
        },
        {
            title: "是否兑奖",
            dataIndex: "isClaimed",
            key: "isClaimed",
            render: (text: boolean) => (
                <Tag color={text ? "green" : "red"} style={{margin: 0}}>
                    {text ? "已兑奖" : "未兑奖"}
                </Tag>
            ),
            width: 150,
            align: 'center' as 'center',
        },
        {
            title: "兑奖时间",
            dataIndex: "claimTimestamp",
            key: "claimTimestamp",
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0}}>
                    {text ? text : "未兑奖"}
                </Tag>
            ),
            width: 200,
            align: 'center' as 'center',
        },
        {
            title: "转账哈希",
            dataIndex: "claimTxHash",
            key: "claimTxHash",
            render: (text: string) => (
                <Tag color="blue" style={{margin: 0}}>
                    {/* 如果有哈希值，创建可点击的链接，点击后跳转至区块链浏览器 */}
                    {text ? (
                        <a
                            href={`https://testnet.monadexplorer.com/tx/${text}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{color: '#1890ff'}}
                        >
                            {`${text.slice(0, 6)}...${text.slice(-4)}`}
                        </a>
                    ) : "暂无"}
                </Tag>
            ),
            width: 250,
            align: 'center' as 'center',
        }
    ];


    // 分页变化时触发的回调
    const handlePaginationChange = (page: number, pageSize: number) => {
        setCurrentPage(page);
        setPageSize(pageSize);
    };

    return (
        <Card
            style={{
                padding: "24px",
                minHeight: "500px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                borderRadius: "16px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                color: "#fff",
            }}
        >
            <Title level={4} style={{color: "#fff", marginBottom: "24px"}}>
                去中心化抽奖信息
            </Title>

            <div style={{maxHeight: "600px", overflowY: "auto"}}>
                <Table
                    dataSource={paginatedData}
                    columns={columns}
                    pagination={{
                        current: currentPage,
                        pageSize: pageSize,
                        total: latestPrizes.length,
                        onChange: handlePaginationChange,
                    }}
                    size="small"
                    rowKey="timestamp"
                    scroll={{x: true, y: 500}}
                    locale={{
                        emptyText: <Text type="secondary">暂无抽奖记录</Text>,
                    }}
                    style={{
                        background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        backdropFilter: "blur(4px)",
                        borderRadius: "12px",
                        color: "#fff",
                    }}
                    tableLayout="fixed"
                    className="custom-table"
                />
            </div>

            {/* 奖池进度条 */}
            <div style={{marginTop: "24px", display: "none"}}>
                <Text strong style={{fontSize: "16px", display: "block", marginBottom: "8px"}}>
                    当前奖池能量
                </Text>
                <Progress
                    percent={Math.min(100)} // 示例：每条记录增加5%奖池能量
                    showInfo
                    format={(percent) => `${percent}%`}
                    strokeColor={{
                        from: "#ff9a9e",
                        to: "#fad0c4",
                    }}
                    trailColor="#ffffff33"
                    style={{marginTop: "8px"}}
                />
                <Text
                    type="secondary"
                    style={{
                        fontSize: "12px",
                        display: "block",
                        textAlign: "right",
                        marginTop: "6px",
                        color: "#ddd",
                    }}
                >
                    每次抽奖都会提升奖池能量！
                </Text>
            </div>
        </Card>
    );
};


// 链上数据
const ChainPanel = () => {
    const [ticket] = useStateTogether<Ticket[]>("ticket", []);
    const [paymentRecord] = useStateTogether<PaymentRecord[]>("paymentRecord", []);
    const [ticketPage, setTicketPage] = useState(1);  // 用于控制抽奖次数表格分页
    const [paymentPage, setPaymentPage] = useState(1);  // 用于控制购票数据表格分页
    const [ticketPageSize] = useState(5); // 每页显示5条抽奖次数数据
    const [paymentPageSize] = useState(5); // 每页显示5条购票数据

    // 设置统一的列宽
    const columnWidth = 200;  // 统一列宽

    const columns = [
        {
            title: "付款地址",
            dataIndex: "address",
            key: "address",
            width: columnWidth,
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0, cursor: "pointer"}} onClick={() => handleCopy(text)}>
                    {text.slice(0, 6)}...{text.slice(-5)}
                </Tag>
            ),
            align: "center" as 'center',
        },
        {
            title: "付款金额",
            dataIndex: "amount",
            key: "amount",
            width: columnWidth,
            render: (text: string) => <Text>{text}</Text>,
            align: "center" as 'center',
        },
        {
            title: "拥有抽奖次数",
            dataIndex: "ticketCount",
            key: "ticketCount",
            width: columnWidth,
            render: (text: string) => <Text>{text}</Text>,
            align: "center" as 'center',
        },
        {
            title: "时间",
            dataIndex: "timestamp",
            key: "timestamp",
            width: columnWidth,
            render: (text: string) => <Tag color="gold" style={{margin: 0}}>{text}</Tag>,
            align: "center" as 'center',
        },
    ];

    const columns_ = [
        {
            title: "付款地址",
            dataIndex: "address",
            key: "address",
            width: columnWidth,
            render: (text: string) => (
                <Tag color="gold" style={{margin: 0, cursor: "pointer"}} onClick={() => handleCopy(text)}>
                    {text.slice(0, 6)}...{text.slice(-5)}
                </Tag>
            ),
            align: "center" as 'center',
        },
        {
            title: "付款金额",
            dataIndex: "amount",
            key: "amount",
            width: columnWidth,
            render: (text: string) => <Text>{text}</Text>,
            align: "center" as 'center',
        },
        {
            title: "交易哈希",
            dataIndex: "hash",
            key: "hash",
            width: columnWidth,
            render: (text: string) => {
                // 取前五个字符和后五个字符
                const displayText = text.slice(0, 5) + "..." + text.slice(-5);
                return (
                    <a href={`https://testnet.monadexplorer.com/tx/${text}`} target="_blank" rel="noopener noreferrer">
                        {displayText}
                    </a>
                );
            },
            align: "center" as "center",
        },
        {
            title: "时间",
            dataIndex: "timestamp",
            key: "timestamp",
            width: columnWidth,
            render: (text: string) => <Tag color="gold" style={{margin: 0}}>{text}</Tag>,
            align: "center" as 'center',
        },
    ];

    // 分页处理方法
    const handleTicketPageChange = (page: number) => {
        setTicketPage(page);
    };

    const handlePaymentPageChange = (page: number) => {
        setPaymentPage(page);
    };

    // 抽奖次数分页
    const ticketData = ticket.slice((ticketPage - 1) * ticketPageSize, ticketPage * ticketPageSize);

    // 购票数据分页
    const paymentData = paymentRecord.slice((paymentPage - 1) * paymentPageSize, paymentPage * paymentPageSize);

    return (
        <Card
            style={{
                padding: "24px",
                minHeight: "500px",  // 确保minHeight一致
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                borderRadius: "16px",
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.15)",
                color: "#fff",
            }}
        >
            <Title level={4} style={{color: "#fff", marginBottom: "24px", display: 'none'}}>
                去中心化抽奖次数
            </Title>

            <div style={{maxHeight: "400px", overflowY: "auto", display: 'none'}}>
                <Table
                    dataSource={ticketData}
                    columns={columns}
                    pagination={{
                        current: ticketPage,
                        pageSize: ticketPageSize,
                        total: ticket.length,  // 总记录数
                        onChange: handleTicketPageChange,
                    }}
                    size="small"
                    rowKey="timestamp"
                    scroll={{x: true, y: 500}}
                    locale={{
                        emptyText: <Text type="secondary">暂无交易记录</Text>,
                    }}
                    style={{
                        background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        backdropFilter: "blur(4px)",
                        borderRadius: "12px",
                        color: "#fff",
                    }}
                    tableLayout="fixed"
                    className="custom-table"
                />
            </div>

            <Title level={4} style={{color: "#fff", marginBottom: "24px", marginTop: "10px"}}>
                去中心化奖池数据
            </Title>

            <div style={{maxHeight: "320px", overflowY: "auto"}}>
                <Table
                    dataSource={paymentData}
                    columns={columns_}
                    pagination={{
                        current: paymentPage,
                        pageSize: paymentPageSize,
                        total: paymentRecord.length,
                        onChange: handlePaymentPageChange,
                    }}
                    size="small"
                    rowKey="timestamp"
                    scroll={{x: true, y: 500}}
                    locale={{
                        emptyText: <Text type="secondary">暂无交易记录</Text>,
                    }}
                    style={{
                        background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                        backgroundColor: "rgba(255, 255, 255, 0.1)",
                        backdropFilter: "blur(4px)",
                        borderRadius: "12px",
                        color: "#fff",
                    }}
                    tableLayout="fixed"
                    className="custom-table"
                />
            </div>

            {/* 奖池进度条 */}
            <div style={{marginTop: "24px", display: "none"}}>
                <Text strong style={{fontSize: "16px", display: "block", marginBottom: "8px"}}>
                    当前奖池能量
                </Text>
                <Progress
                    percent={Math.min(100)} // 示例：每条记录增加5%奖池能量
                    showInfo
                    format={(percent) => `${percent}%`}
                    strokeColor={{
                        from: "#ff9a9e",
                        to: "#fad0c4",
                    }}
                    trailColor="#ffffff33"
                    style={{marginTop: "8px"}}
                />
                <Text
                    type="secondary"
                    style={{
                        fontSize: "12px",
                        display: "block",
                        textAlign: "right",
                        marginTop: "6px",
                        color: "#ddd",
                    }}
                >
                    每次抽奖都会提升奖池能量！
                </Text>
            </div>
        </Card>
    );
};

// 总组件
const SHADOW_STYLE = "0 6px 16px rgba(0, 0, 0, 0.1)";
export const PrimeInner = () => {
    const {address, isConnected} = useAccount();
    const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
    const updateOnlineUsers = (newUser: string) => {
        setOnlineUsers((prev) => new Set(prev.add(newUser)));
    };

    const removeUser = (address: `0x${string}` | undefined) => {
        setOnlineUsers((prev) => {
            const updatedUsers = new Set(prev);
            // @ts-ignore
            updatedUsers.delete(address);
            return updatedUsers;
        });
    };

    useEffect(() => {
        if (isConnected && address) {
            updateOnlineUsers(address); // Add user when connected
        } else {
            removeUser(address); // Remove user when disconnected
        }
    }, [address, isConnected]);

    const tabs = useMemo(
        () => [
            {
                key: "lottery",
                label: "转盘抽奖",
                children: <WheelOfFortune address={address || null}/>,
            },
            {
                key: "chat",
                label: "在线聊天",
                children: <ChatPanel address={address || null}/>,
            },
            {
                key: "InfoPanel",
                label: "抽奖数据",
                children: <InfoPanel/>,
            },
            {
                key: "ChainPanel",
                label: "链上数据",
                children: <ChainPanel/>,
            },
            {
                key: "decentralizedLottery",
                label: "去中心化抽奖说明",  // 新增 tab
                children: <DecentralizedLotteryExplanation/>,  // 新增的说明组件
            }
        ],
        [address]
    );

    return (
        <Layout style={{backgroundColor: "#f5f5f5"}}>
            <Header
                style={{
                    display: "flex",
                    background: "linear-gradient(135deg, #6e7bff, #a3a8f7)",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "0 24px",
                    height: "54px",
                    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                    zIndex: 1000,
                }}
            >
                <Title level={3} style={{color: "#fff", margin: 0}}>
                    加密转盘 - CryptoWheel
                </Title>
                <div style={{display: "flex", alignItems: "center", gap: 16}}>
                    <Tag
                        style={{
                            color: "#fff",  // 保持文字颜色为白色，确保可见
                            backgroundColor: '#6e7bff'  // 使用与你的背景颜色一致的主题色
                        }}
                    >
                        在线人数：{onlineUsers.size}
                    </Tag>
                </div>
                <Connector>
                    <ConnectButton/>
                </Connector>
            </Header>

            <Content
                style={{
                    padding: 24,
                    display: "flex",
                    justifyContent: "center",  // 水平居中
                    alignItems: "flex-start", // 顶部对齐
                    minHeight: "calc(100vh - 64px)",  // 计算剩余空间，避免内容区域过高或过低
                    backgroundColor: "#f5f5f5",
                }}
            >
                <div style={{width: "75%", paddingLeft: 16, display: "flex", flexDirection: "column", flex: 1}}>
                    <Tabs
                        defaultActiveKey="lottery"
                        type="card"
                        items={tabs}
                        tabBarStyle={{
                            marginBottom: 10,
                            borderRadius: "12px",
                            borderColor: "#d9d9d9",
                            boxShadow: SHADOW_STYLE,
                        }}
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "12px",
                            boxShadow: SHADOW_STYLE,
                            padding: "20px",  // 给Tabs增加统一padding，避免tab间距不一致
                            flex: 1, // 使Tabs容器占据剩余空间
                        }}
                    />
                </div>
            </Content>

            <Footer
                style={{
                    textAlign: "center",
                    backgroundColor: "#fff",
                    borderTop: "1px solid #e8e8e8",
                    fontSize: "14px",
                    color: "#666",
                    padding: "12px 0",
                }}
            >
                <Space direction="vertical">
                    <Text>Shared state by Multisynq · Web3 identity via Monad Testnet</Text>
                    <Text>{address ? <Address address={address} copyable/> : "Guest"}</Text>
                </Space>
            </Footer>
        </Layout>
    );
};
export default function App() {
    return (
        <WagmiWeb3ConfigProvider
            config={wagmiConfig}
            eip6963={{
                autoAddInjectedWallets: true,
            }}
            balance={true}
            wallets={[OkxWallet(), MetaMask(), WalletConnect()]}
        >
            <ConfigProvider theme={{algorithm: theme.defaultAlgorithm, token: {colorPrimary: "#1e90ff"}}}>
                <PrimeInner/>
            </ConfigProvider>
        </WagmiWeb3ConfigProvider>
    );
}
