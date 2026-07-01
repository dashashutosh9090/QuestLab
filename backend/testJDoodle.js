import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const normalizeOutput = (value = '') => String(value).replace(/\r\n/g, '\n').trim();

const testJDoodle = async () => {
    try {
        console.log('Sending request to JDoodle...');
        const executeRes = await axios.post('https://api.jdoodle.com/v1/execute', {
            clientId: process.env.JDOODLE_CLIENT_ID,
            clientSecret: process.env.JDOODLE_CLIENT_SECRET,
            script: "l,w = map(int,input().split())\nprint(l*w)",
            language: 'python3',
            versionIndex: '4',
            stdin: '2 3'
        }, { timeout: 15000 });

        console.log('JDoodle Response Data:', executeRes.data);
        const data = executeRes.data;
        const output = data?.output ? normalizeOutput(data.output) : '';
        
        let isError = false;
        if (data?.statusCode !== 200) {
            isError = true;
        } else if (data?.memory === null && data?.cpuTime === null) {
            isError = true;
        }

        console.log('Normalized Output:', output);
        console.log('Is Error:', isError);

    } catch (err) {
        console.error('JDoodle test failed:', err.message);
        if (err.response) {
            console.error('Response data:', err.response.data);
        }
    }
};

testJDoodle();
