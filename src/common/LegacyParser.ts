import { Transaction } from "../models/TransactionModel";
import { TokenParser } from "./TokenParser";
import { TransactionParser } from "./TransactionParser";
import * as winston from "winston";


export class LegacyParser {

    private parallelReparse = 200;
    private tokenParser = new TokenParser();
    private transactionParser = new TransactionParser();

    public reparseChain() {


        Transaction.find({
            $or: [
                       {addresses:  { $exists: false }},
                       {addresses:  { $eq: [] }},        
            ],
        }).limit(this.parallelReparse).exec().then((transactions: any) => {
            if (transactions && transactions.length > 0) {
                transactions.map((transaction: any) => {
                   transaction.addresses = [transaction.from, transaction.to];
                   transaction.save().catch((err: Error) => {
                       console.log(`Error while saving transaction ${transaction._id} with error ${err}`);
                   });
                });
                return this.tokenParser.parseERC20Contracts(transactions).then(([transactions, contracts]: any) => {
                    this.transactionParser.parseTransactionOperations(transactions, contracts);
                });
            } else {
                return Promise.resolve("Finished");
            }
        }).then((result: any) => {
            if (result !== "Finished") {
                winston.info(`Reparsed ${this.parallelReparse} transactions`);
                this.scheduleToRestart(1000);
            } else {
                winston.info(`Finished reparse`);
            }

        }).catch((err: Error) => {
            winston.info(`Error while reparsing: ${err}`);
        });
    }

    private scheduleToRestart(delay: number) {
        this.delay(delay).then(() => {
            this.reparseChain();
        });
    }

    private delay(t: number) {
        return new Promise((resolve) => {
            setTimeout(resolve, t);
        });
    }

}
