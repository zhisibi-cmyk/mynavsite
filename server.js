const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const SECRET_KEY = 'my_super_secret_key_change_me'; // 请修改这个密钥
const DB_FILE = path.join(__dirname, 'data', 'db.json');

app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));
// 新增：访问 /admin 时返回 admin.html
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// 初始化数据库
if (!fs.existsSync(DB_FILE)) {
    const initialData = {
        password: 'admin', // 默认密码
        categories: [
            {
                id: 1, name: "常用工具", links: [
                    { name: "Google", url: "https://google.com", icon: "https://www.google.com/favicon.ico" }
                ]
            }
        ]
    };
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
}

// 辅助函数：读写数据库
const getDb = () => JSON.parse(fs.readFileSync(DB_FILE));
const saveDb = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

// 中间件：验证 Token
const auth = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ message: 'No token' });
    try {
        jwt.verify(token.split(' ')[1], SECRET_KEY);
        next();
    } catch (e) {
        res.status(401).json({ message: 'Unauthorized' });
    }
};



// API: 获取 Bing 壁纸 (随机切换版)
app.get('/api/bing', async (req, res) => {
    try {
        // 方案 A: 使用第三方随机接口 (图库更丰富)
        // biturl.top 是一个稳定的 Bing 壁纸存档接口，index=random 表示随机
        const response = await axios.get('https://bing.biturl.top/?resolution=1920&format=json&index=random&mkt=zh-CN', { timeout: 3000 });
        res.json({ url: response.data.url });
    } catch (error) {
        // 方案 B: 降级方案 - 使用官方接口 (在最近 8 天内随机)
        try {
            console.log('第三方接口超时，切换至官方随机...');
            const randomIdx = Math.floor(Math.random() * 8); // 0-7 随机数
            const officialRes = await axios.get(`https://www.bing.com/HPImageArchive.aspx?format=js&idx=${randomIdx}&n=1&mkt=zh-CN`);
            const url = 'https://www.bing.com' + officialRes.data.images[0].url;
            res.json({ url });
        } catch (err) {
            // 方案 C: 最后的保底 (静态图)
            res.json({ url: 'https://images.unsplash.com/photo-1477346611705-65d1883cee1e?auto=format&fit=crop&w=1920&q=80' });
        }
    }
});



// API: 登录
app.post('/api/login', (req, res) => {
    const { password } = req.body;
    const db = getDb();
    if (password === db.password) {
        const token = jwt.sign({ role: 'admin' }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token });
    } else {
        res.status(401).json({ message: '密码错误' });
    }
});

// API: 修改密码
app.post('/api/change-password', auth, (req, res) => {
    const { newPassword } = req.body;
    const db = getDb();
    db.password = newPassword;
    saveDb(db);
    res.json({ success: true });
});

// API: 获取所有数据 (公开)
app.get('/api/data', (req, res) => {
    const db = getDb();
    res.json({ categories: db.categories });
});

// API: 更新数据 (需要登录)
app.post('/api/data', auth, (req, res) => {
    const db = getDb();
    db.categories = req.body.categories;
    saveDb(db);
    res.json({ success: true });
});

// 强制监听 0.0.0.0，确保 Docker 外部能访问
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});