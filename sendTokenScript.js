require("dotenv").config();
const { ethers } = require("ethers");
const fs = require("fs");
const axios = require("axios");

// Load environment variables
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.RPC_URL;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

// ABI for the token contract (simplified, add full ABI as needed)
const CONTRACT_ABI = JSON.parse(fs.readFileSync("contractABI.json", "utf8"));

// Setup provider and wallet
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, wallet);

// Function to send tokens
// Function to Fetch Gas Price from BSC
async function getGasPrice() {
    const gasPrice = await provider.getFeeData();
    return gasPrice.gasPrice; // Returns gas price in Wei
}

// Function to Estimate Gas for buyPresaleToken
async function estimateGasForBuyPresaleToken(buyOptions, usdtToken, receiverAddress, tokenAmount) {
    try {
        console.log("Estimating gas required for buyPresaleToken...");

        // Estimate gas limit
        const estimatedGas = await contract.buyPresaleToken.estimateGas(
            buyOptions,
            ethers.parseUnits(usdtToken.toString(), 18),
            receiverAddress,
            ethers.parseUnits(tokenAmount.toString(), 18)
        );

        console.log(`Estimated Gas Limit: ${estimatedGas.toString()}`);
        return estimatedGas;
    } catch (error) {
        console.error("Error estimating gas:", error);
        return null;
    }
}

// Function to Calculate Gas Fee in BNB
async function calculateGasFeeInBNB(buyOptions, usdtToken, receiverAddress, tokenAmount) {
    console.log(`Inside calculateGasFeeInBNB`);

    const gasPrice = await getGasPrice();
    const gasLimit = await estimateGasForBuyPresaleToken(buyOptions, usdtToken, receiverAddress, tokenAmount);

    if (!gasPrice || !gasLimit) return null;

    const gasFee = gasPrice * gasLimit; // Gas Fee in Wei
    const gasFeeInBNB = ethers.formatUnits(gasFee, "ether"); // Convert Wei to BNB

    console.log(`Gas Fee (BNB): ${gasFeeInBNB}`);
    return gasFeeInBNB;
}

// Function to Get BNB Price in Fiat (USD)
async function getBNBPriceInUSD() {
    try {
        const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT");
        return parseFloat(response.data.price);
    } catch (error) {
        console.error("Error fetching BNB price:", error);
        return null;
    }
}

// Function to Convert Gas Fee to Fiat (USD)
async function convertGasFeeToFiat(gasFeeBNB) {
    const bnbPrice = await getBNBPriceInUSD();
    if (!bnbPrice) return null;

    const gasFeeInFiat = gasFeeBNB * bnbPrice;
    console.log(`Gas Fee in USD: $${gasFeeInFiat.toFixed(2)}`);
    return gasFeeInFiat;
}

// Fetch BNB Price in USD
async function getBNBPriceInUSD() {
    try {
        const response = await axios.get("https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT");
        return parseFloat(response.data.price);
    } catch (error) {
        console.error("Error fetching BNB price:", error);
        return null;
    }
}

// Fetch USD to INR Exchange Rate
async function getUSDToINRRate() {
    try {
        const response = await axios.get("https://api.exchangerate-api.com/v4/latest/USD");
        return parseFloat(response.data.rates.INR);
    } catch (error) {
        console.error("Error fetching USD to INR rate:", error);
        return null;
    }
}

// Convert Gas Fee to INR
async function convertGasFeeToINR(gasFeeBNB) {
    const bnbPrice = await getBNBPriceInUSD();
    const usdToInrRate = await getUSDToINRRate();

    if (!bnbPrice || !usdToInrRate) return null;

    const gasFeeInUSD = gasFeeBNB * bnbPrice;
    const gasFeeInINR = gasFeeInUSD * usdToInrRate;

    console.log(`Gas Fee in INR: ₹${gasFeeInINR.toFixed(2)}`);
    return gasFeeInINR;
}
// Function to Buy Presale Tokens & Include Gas Fee in Fiat Payment
async function buyPresaleTokenWithGasFee(buyOptions, usdtToken, receiverAddress, tokenAmount) {
    try {
        console.log(`Calculating gas fee for buyPresaleToken...`);

        const gasFeeBNB = await calculateGasFeeInBNB(buyOptions, usdtToken, receiverAddress, tokenAmount);
        const gasFeeUSD = await convertGasFeeToFiat(gasFeeBNB);
        const gasFeeINR = await convertGasFeeToINR(gasFeeBNB);

        if (!gasFeeUSD) {
            console.error("Gas fee calculation failed!");
            return;
        }

        console.log(`Total Gas Cost in Fiat (USD): $${gasFeeUSD.toFixed(2)}`);

        // Adjust the total fiat bill (example: token price + gas fee)
        const finalFiatAmount = parseFloat(usdtToken) + gasFeeUSD;
        console.log(`Final Amount Buyer Needs to Pay (USD): $${finalFiatAmount.toFixed(2)}`);

        const finalFiatAmountInRuppes = parseFloat(usdtToken) + gasFeeINR;
        console.log(`Final Amount Buyer Needs to Pay (INR): ₹${finalFiatAmountInRuppes}`);

        // Proceed with the token transfer
        console.log("Executing buyPresaleToken transaction...");

        const tx = await contract.buyPresaleToken(
            buyOptions,
            ethers.parseUnits(usdtToken.toString(), 18), // Convert to Wei
            receiverAddress,
            ethers.parseUnits(tokenAmount.toString(), 18) // Convert to Wei
        );

        console.log("Transaction sent! TX Hash:", tx.hash);

        await tx.wait();
        console.log("Transaction confirmed! Tokens sent.");
    } catch (error) {
        console.error("Error executing buyPresaleToken:", error);
    }
}

// Example Usage - Modify values as needed
buyPresaleTokenWithGasFee(
    1, // 0 = USDT, 1 = Fiat
    "1000", // USDT amount (0 if Fiat is used)
    "0xf58092867d18af66Bb16282E7864F590436Cf993", // Replace with actual receiver address
    "100" // Token amount
);