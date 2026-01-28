import React, { useEffect, useState } from "react";
import { ethers } from "ethers";

import { contractABI, contractAddress } from "../utils/constants";

export const TransactionContext = React.createContext();

const { ethereum } = window;
const createEthereumContract = () => {
  const { ethereum } = window;
  if (!ethereum) throw new Error("MetaMask not found");

  const provider = new ethers.providers.Web3Provider(ethereum);
  const signer = provider.getSigner();

  return new ethers.Contract(contractAddress, contractABI, signer);
};


export const TransactionsProvider = ({ children }) => {
  const [formData, setformData] = useState({ addressTo: "", amount: "", keyword: "", message: "" });
  const [currentAccount, setCurrentAccount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [transactionCount, setTransactionCount] = useState(localStorage.getItem("transactionCount"));
  const [transactions, setTransactions] = useState([]);

  const handleChange = (e, name) => {
    setformData((prevState) => ({ ...prevState, [name]: e.target.value }));
  };

  const getAllTransactions = async () => {
    try {
      if (ethereum) {
        const transactionsContract = createEthereumContract();

        const availableTransactions = await transactionsContract.getAllTransactions();

        const structuredTransactions = availableTransactions.map((transaction) => ({
          addressTo: transaction.receiver,
          addressFrom: transaction.sender,
          timestamp: new Date(transaction.timestamp.toNumber() * 1000).toLocaleString(),
          message: transaction.message,
          keyword: transaction.keyword,
          amount: parseInt(transaction.amount._hex) / (10 ** 18)
        }));

        console.log(structuredTransactions);

        setTransactions(structuredTransactions);
      } else {
        console.log("Ethereum is not present");
      }
    } catch (error) {
      console.log(error);
    }
  };

  const checkIfWalletIsConnect = async () => {
  const { ethereum } = window;
  if (!ethereum) return alert("Please install MetaMask");

  const accounts = await ethereum.request({ method: "eth_accounts" });
  if (accounts.length) setCurrentAccount(accounts[0]);
};


  const checkIfTransactionsExists = async () => {
    try {
      if (ethereum) {
        const transactionsContract = createEthereumContract();
        const currentTransactionCount = await transactionsContract.getTransactionCount();

        window.localStorage.setItem("transactionCount", currentTransactionCount);
      }
    } catch (error) {
      console.log(error);

      throw new Error("No ethereum object");
    }
  };

  const connectWallet = async () => {
    try {
      if (!ethereum) return alert("Please install MetaMask.");

      const accounts = await ethereum.request({ method: "eth_requestAccounts", });

      setCurrentAccount(accounts[0]);
      window.location.reload();
    } catch (error) {
      console.log(error);

      throw new Error("No ethereum object");
    }
  };

 const sendTransaction = async () => {
  try {
    const { ethereum } = window;
    if (!ethereum) {
      alert("Please install MetaMask");
      return;
    }

    const { addressTo, amount, keyword, message } = formData;

    const provider = new ethers.providers.Web3Provider(ethereum);
    const signer = provider.getSigner();
    const parsedAmount = ethers.utils.parseEther(amount);

    // 1️⃣ Send ETH
    const tx = await signer.sendTransaction({
      to: addressTo,
      value: parsedAmount,
    });

    setIsLoading(true);
    await tx.wait();

    // 2️⃣ Save tx on contract
    const transactionsContract = createEthereumContract();
    const txHash = await transactionsContract.addToBlockchain(
      addressTo,
      parsedAmount,
      message,
      keyword
    );

    await txHash.wait();

    setIsLoading(false);

    const count = await transactionsContract.getTransactionCount();
    setTransactionCount(count.toNumber());

  } catch (error) {
    console.error(error);
    setIsLoading(false);
  }
};

  useEffect(() => {
    checkIfWalletIsConnect();
    checkIfTransactionsExists();
  }, [transactionCount]);

  return (
    <TransactionContext.Provider
      value={{
        transactionCount,
        connectWallet,
        transactions,
        currentAccount,
        isLoading,
        sendTransaction,
        handleChange,
        formData,
      }}
    >
      {children}
    </TransactionContext.Provider>
  );
};
