import React from 'react';
import ReactDOM from 'react-dom/client';
import {ReactTogether} from 'react-together';
import 'antd/dist/reset.css';
// import ChatApp from "./ChatApp";
// import Prime from "./Prime";
import 'antd/dist/reset.css';
// import PrimeInner from "./Prime";
import App from "./Prime";
// import ChatApp from "./ChatApp";
// import PaymentInUSDT from "./components/usdt";
// import App from "./App";
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <ReactTogether
            sessionParams={{
                appId: 'crypto-wheel-beryl.vercel.app',
                apiKey: '2WZlojthZ18mcxFxH7BqwJ19HqsMhSfSjTLwPUVfkq',
                name: 'wheelberylvercel',
                password: 'cryptowheel',
            }}
        >
            <App/>
        </ReactTogether>
    </React.StrictMode>,
);
