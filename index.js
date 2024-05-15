const http = require('http');
const url = require('url');
const QRCode = require('qrcode');
const { initializeApp } = require('firebase/app');
const { getFirestore, doc, getDocs, query, collection, where, updateDoc, increment } = require('firebase/firestore');
const querystring = require('querystring');

const firebaseConfig = {
    apiKey: "AIzaSyAAeJ0boY6dqXcK8ntpTdP5HwNLLnL76oo",
    authDomain: "code-catalysts.firebaseapp.com",
    databaseURL: "https://code-catalysts-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "code-catalysts",
    storageBucket: "code-catalysts.appspot.com",
    messagingSenderId: "33787728039",
    appId: "1:33787728039:web:7bb22366d02c624eb74b82",
    measurementId: "G-5WHW1TF34X"
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore();

// Function to fetch data from Firebase using account number
async function fetchDataFromFirebase(accountNumber) {
    try {
        const querySnapshot = await getDocs(query(collection(firestore, 'users'), where('account_no', '==', accountNumber)));
        if (querySnapshot.empty) {
            throw new Error('No user found with this account number!');
        }
        const userData = querySnapshot.docs[0].data();
        userData.id = querySnapshot.docs[0].id;
        return userData;
    } catch (error) {
        console.error('Error fetching data from Firebase:', error);
        throw error;
    }
}

// Function to generate QR code data URL
async function generateQRCodeDataUrl(senderAccountNumber, receiverAccountNumber, amount) {
    try {
        const qrCodeData = {
            senderAccountNumber,
            receiverAccountNumber,
            amount
        };

        const qrCodeDataString = JSON.stringify(qrCodeData);

        const qrCodeDataUrl = await QRCode.toDataURL(qrCodeDataString);

        return qrCodeDataUrl;
    } catch (error) {
        console.error('Error generating QR code data URL:', error);
        throw error;
    }
}

// Function to process QR code data
async function processQRCodeData(qrCodeData) {
    try {
        const { senderAccountNumber, receiverAccountNumber, amount } = qrCodeData;

        const senderUserData = await fetchDataFromFirebase(senderAccountNumber);
        if (!senderUserData) {
            throw new Error('Sender account number does not exist');
        }

        const receiverUserData = await fetchDataFromFirebase(receiverAccountNumber);
        if (!receiverUserData) {
            throw new Error('Receiver account number does not exist');
        }

        await updateDoc(doc(firestore, 'users', senderUserData.id), {
            total_balance: increment(-amount)
        });

        await updateDoc(doc(firestore, 'users', receiverUserData.id), {
            total_balance: increment(amount)
        });

        return { success: true };
    } catch (error) {
        console.error('Error processing QR code data:', error);
        throw error;
    }
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);

    if (parsedUrl.pathname === '/' || parsedUrl.pathname === '/generateQR') {
        if (req.method === 'GET') {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.write('<!DOCTYPE html><html><head><title>QR Code Generator</title></head><body>');
            res.write('<form action="/generateQR" method="post">');
            res.write('Sender Account Number: <input type="text" name="senderAccountNumber"><br>');
            res.write('Receiver Account Number: <input type="text" name="receiverAccountNumber"><br>');
            res.write('Amount: <input type="text" name="amount"><br>');
            res.write('<input type="submit" value="Generate QR Code">');
            res.write('</form></body></html>');
            res.end();
        } else if (req.method === 'POST') {
            try {
                let body = '';
                req.on('data', chunk => {
                    body += chunk.toString();
                });
                req.on('end', async () => {
                    const postData = querystring.parse(body);
                    const senderAccountNumber = postData.senderAccountNumber;
                    const receiverAccountNumber = postData.receiverAccountNumber;
                    const amount = parseFloat(postData.amount);

                    const qrCodeData = {
                        senderAccountNumber,
                        receiverAccountNumber,
                        amount
                    };

                    const result = await processQRCodeData(qrCodeData);

                    if (result.success) {
                        const qrCodeDataUrl = await generateQRCodeDataUrl(senderAccountNumber, receiverAccountNumber, amount);

                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.write('<!DOCTYPE html><html><head><title>QR Code</title></head><body>');
                        res.write(`<img src="${qrCodeDataUrl}" alt="QR Code">`);
                        res.write('</body></html>');
                        res.end();
                    } else {
                        throw new Error('Error processing QR code data');
                    }
                });
            } catch (error) {
                console.error('Error handling request:', error);
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.write('Internal Server Error');
                res.end();
            }
        }
    }
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});