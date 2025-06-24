需求标题：基于MultiSYNQ和Monad Testnet的MetaVerse协作空间开发

背景与目标：  
我需要开发一个名为“MetaVerse协作空间”的去中心化多人在线协作平台，目标用户是Web3开发者、设计师和创意团队。核心是通过MultiSYNQ实现实时协作功能，并集成Monad Testnet的区块链能力（如智能合约、NFT、支付），打造一个兼具趣味性和实用性的虚拟协作环境。

需要ChatGPT协助的具体任务：
技术架构设计

如何结合MultiSYNQ（实时协作）和Monad Testnet（区块链）设计后端架构？

是否需要特定的数据库或去中心化存储方案（如IPFS）？  
智能合约开发

编写Monad Testnet的智能合约示例，功能包括：

用户贡献记录（如任务完成度）

NFT生成逻辑（每个任务/项目完成后自动生成NFT）

代币奖励分发（基于贡献值）

合约需与前端（如React/Vue）交互的代码片段。  
实时协作功能实现

基于MultiSYNQ的代码示例：

创建虚拟房间、实时白板/文档协作

用户角色同步（如小马虚拟形象的移动/交互）  
前端与区块链集成

如何连接Monad Testnet钱包（如MetaMask）？

展示NFT和代币交易的界面设计建议（需简洁易懂）。  
小马虚拟角色系统

如何将用户虚拟角色（小马NFT）与协作功能绑定？

示例：用户完成任务后，小马NFT获得“装备”或“勋章”属性更新。  
演示Demo开发

提供Vercel部署的步骤（如Next.js项目配置）。

如何录制一个展示核心功能的Demo视频（脚本建议）。

其他要求：
代码语言：优先使用JavaScript/TypeScript（前端）和Solidity（合约）。

安全性：需避免智能合约常见漏洞（如重入攻击）。

用户体验：强调趣味性（如小马元素）与功能性平衡。

示例输出格式：  
智能合约代码：

solidity
// Monad Testnet NFT合约示例  
contract TaskNFT {  
function mintNFT(address contributor, string memory metadataURI) public {  
// 实现逻辑...  
}


前端集成代码：

javascript
// 连接Monad Testnet钱包  
async function connectWallet() {  
await window.ethereum.request({ method: 'eth_requestAccounts' });




最终交付物：  
技术方案文档（含架构图）。

可运行的代码片段（合约+前端）。

Demo部署指南（Vercel）。

请根据优先级分步骤指导，并标注需要我进一步澄清的部分！

--- 

通过这份文案，ChatGPT可以明确你的需求边界并提供针对性建议，减少来回沟通成本。如果需要更细节的补充（如设计稿或竞品参考），可额外说明。
