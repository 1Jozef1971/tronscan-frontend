/* eslint-disable no-restricted-globals */
import {connect} from "react-redux";
import React, {Fragment} from "react";
import {injectIntl} from "react-intl";
import {tu} from "../../../utils/i18n";
import {Client} from "../../../services/api";
import {isAddressValid} from "@tronscan/client/src/utils/crypto";
import SendOption from "./../SendOption";
import {find, round} from "lodash";
import {ONE_TRX,API_URL} from "../../../constants";
import {Alert} from "reactstrap";
import {reloadWallet} from "../../../actions/wallet";
import {FormattedNumber} from "react-intl";
import SweetAlert from "react-bootstrap-sweetalert";
import {TronLoader} from "../../common/loaders";
import {login} from "../../../actions/app";
import {pkToAddress} from "@tronscan/client/src/utils/crypto";
import _ from "lodash";
import Lockr from "lockr";
import xhr from "axios";
import {Select} from 'antd';
const { Option, OptGroup } = Select;

class SendForm extends React.Component {

  constructor(props) {
    super(props);

    this.state = {
      privateKey: "",
      to: props.to || "",
      token: "",
      amount: '',
      note: '',
      sendStatus: 'waiting',
      isLoading: false,
      toAccount: null,
      modal: null,
      tokens20:[],
      decimals:'',
      balance:'',
    };
  }

  /**
   * Check if the form is valid
   * @returns {*|boolean}
   */
  isValid = () => {
    let {to, token, amount, privateKey,balance} = this.state;
    let {account} = this.props;
    /*
       if (!privateKey || privateKey.length !== 64) {
         return false;
       }

      if(privateKey && privateKey.length === 64 && pkToAddress(privateKey) !== account.address){
         return false;
       }
    */
    return isAddressValid(to) && token !== "" && balance >= amount && amount > 0 && to !== account.address;
  };

  /**
   * Send the transaction
   */
  send =() =>{
      let {token} = this.state;
      let TokenType =  token.substr(token.length-5,5);
      if(TokenType == 'TRC10'){
          if (Lockr.get("islogin")) {
              this.tokenSendWithTronLink();
          }else {
              this.token10Send()
          }
      }else if(TokenType == 'TRC20'){
          this.token20Send()
      }
  };

  tokenSendWithTronLink = async() => {
      let {to, token, amount, note, privateKey} = this.state;
      let TokenName =  token.substring(0,token.length-6);
      let {account, onSend} = this.props;
      let result,success;
      const { tronWeb } = account;
      this.setState({isLoading: true, modal: null});

      if (TokenName === "TRX") {
          amount = amount * ONE_TRX;
          result = await tronWeb.trx.sendTransaction(to, amount, false).catch(function (e) {
              console.log(e)
          });
          if(result){
              success = result.result;
          }else{
              success = false;
          }

      }else{
          result = await tronWeb.trx.sendToken(to, amount, TokenName, false);
          success = result.result;
          if(result){
              success = result.result;
          }else{
              success = false;
          }
      }

      //let {success} = await Client.sendWithNote(TokenName, account.address, to, amount, note)(account.key);

      if (success) {
          this.refreshTokenBalances();

          onSend && onSend();
          //two work flows!

          this.setState({
              sendStatus: 'success',
              isLoading: false,
          });
      } else {
          this.setState({
              sendStatus: 'failure',
              isLoading: false,
          });

          setTimeout(() => {
              this.setState({
                  sendStatus: 'waiting',
              });
          }, 2000);
      }
  }

  token10Send = async () => {
    let {to, token, amount, note, privateKey} = this.state;
    let TokenName =  token.substring(0,token.length-6);
    let {account, onSend} = this.props;

    this.setState({isLoading: true, modal: null});

    if (TokenName === "TRX") {
      amount = amount * ONE_TRX;
    }

    let {success} = await Client.sendWithNote(TokenName, account.address, to, amount, note)(account.key);

    if (success) {
      this.refreshTokenBalances();

      onSend && onSend();
      //two work flows!

      this.setState({
        sendStatus: 'success',
        isLoading: false,
      });
    } else {
      this.setState({
        sendStatus: 'failure',
        isLoading: false,
      });

      setTimeout(() => {
        this.setState({
          sendStatus: 'waiting',
        });
      }, 2000);
    }
  };

  token20Send = async () => {

      let {to, token, amount, note, decimals,tokens20} = this.state;
      let TokenName =  token.substring(0,token.length-6);
      let {account, onSend} = this.props;
      this.setState({isLoading: true, modal: null});
      let contractAddress = find(tokens20, t => t.name === TokenName).contract_address;
      let  contractInstance = await account.tronWeb.contract().at(contractAddress);
      const transctionId = await contractInstance.transfer(to, Math.ceil(amount * Math.pow(10, decimals))).send();
      if (transctionId) {
          this.refreshTokenBalances();
          onSend && onSend();
          //two work flows!

          this.setState({
              sendStatus: 'success',
              isLoading: false,
          });
      }else {
          this.setState({
              sendStatus: 'failure',
              isLoading: false,
          });

          setTimeout(() => {
              this.setState({
                  sendStatus: 'waiting',
              });
          }, 2000);
      }

  }

  confirmSend = () => {

    let {to, token, amount} = this.state;
    let TokenName =  token.substring(0,token.length-6);
    this.setState({
      modal: (
          <SweetAlert
              info
              showCancel
              cancelBtnText={tu("cancel")}
              confirmBtnText={tu("confirm")}
              cancelBtnBsStyle="default"
              title={tu("confirm_transaction")}
              onConfirm={this.send}
              onCancel={this.hideModal}
              style={{marginLeft: '-240px', marginTop: '-195px'}}
          >
            {tu("transfer_confirm_info")}<br/>
            <span className="font-weight-bold">{' '}
              <FormattedNumber
                  maximumFractionDigits={7}
                  minimunFractionDigits={7}
                  value={amount}/>{' '}
              {TokenName + ' '}
          </span><br/>
            {tu("to")}<br/>
            {to}
          </SweetAlert>
      )
    });
  };

  hideModal = () => {
    this.setState({
      modal: null,
    });
  };

  setAmount = (amount) => {
    let {token, decimals} = this.state;
    let TokenType =  token.substr(token.length-5,5);
    let TokenName =  token.substring(0,token.length-6);
    if (token && TokenType == 'TRC10') {
        if(TokenName == 'TRX'){
            if (amount !== '') {
                amount = parseFloat(amount);
                amount = round(amount, 6);
                if (amount <= 0) {
                    amount = 0;
                }
            }
        }else{
            if (amount !== '') {
                amount = parseFloat(amount);
                amount = round(amount,0);
                if (amount <= 0) {
                    amount = 0;
                }
            }
        }
    }else if(token && TokenType == 'TRC20'){
        if (amount !== '') {
            amount = parseFloat(amount);
            amount = round(amount, decimals);
            if (amount <= 0) {
                amount = 0;
            }
        }
    }


    this.setState({
      amount,
    });
  };

  getSelectedTokenBalance = () => {
    let {tokenBalances} = this.props;
    let {token,tokens20} = this.state;
    let TokenType =  token.substr(token.length-5,5);
    let TokenName =  token.substring(0,token.length-6);
    if (token && TokenType == 'TRC10') {
        let balance = parseFloat(find(tokenBalances, t => t.name === TokenName).balance);
        if(TokenName == 'TRX'){
            this.setState({
                decimals: 6,
                balance:balance
            })
        }else{
            this.setState({
                decimals: 0,
                balance:balance
            })
        }
    }else if(token && TokenType == 'TRC20'){
        let balance = parseFloat(find(tokens20, t => t.name === TokenName).balance);
        let TokenDecimals = parseFloat(find(tokens20, t => t.name === TokenName).decimals);
        this.setState({
            decimals: TokenDecimals,
            balance:balance
        })
    }

    return 0;
  };

  isAmountValid = () => {
    let {amount,balance} = this.state;
    let selectedTokenBalance = balance;
    return amount !== 0 && amount !== '' && selectedTokenBalance >= amount;
  };

  componentDidMount() {
    this.refreshTokenBalances();

    //this.setAddress(this.props.to);

  }

  refreshTokenBalances = () => {
    let {account} = this.props;
    if (account.isLoggedIn) {
      this.props.reloadWallet();
      this.getTRC20Tokens();
    }
  };

  componentDidUpdate() {
    let {tokenBalances} = this.props;
    tokenBalances = _(tokenBalances).filter(tb => tb.balance > 0).value();
    let {token,tokens20} = this.state;
    if (!token && tokenBalances.length > 0) {
      this.setState({
        token: tokenBalances[0].name + '-TRC10',
      },() =>{
        this.getSelectedTokenBalance()
      })

    }else if(!token && tokens20.length > 0 && tokenBalances.length == 0){
        this.setState({
            token: tokens20[0].name + '-TRC20',
        },() =>{
            this.getSelectedTokenBalance()
        })
    }
  }

  renderFooter() {

    let {sendStatus, isLoading} = this.state;

    if (sendStatus === 'success') {
      return (
          <Alert color="success" className="text-center">
            {tu("successful_send")}
          </Alert>
      )
    }

    if (sendStatus === 'failure') {
      return (
          <Alert color="danger" className="text-center">
            Something went wrong while submitting the transaction
          </Alert>
      )
    }

    return (
        <Fragment>

          {/*<Alert color="warning" className="text-center">*/}
          {/*{tu("address_warning")}*/}
          {/*</Alert>*/}
          <button
              type="button"
              disabled={!this.isValid() || isLoading}
              className="btn btn-primary btn-block btn-lg"
              onClick={this.confirmSend}>{tu("send")}</button>
        </Fragment>
    )
  }

  setMaxAmount = () => {
    let {balance} = this.state;
    this.setState({
      amount: balance,
    });
  };

  resetForm = () => {
    this.setState({
      amount: '',
      sendStatus: 'waiting',
      isLoading: false,
      to: "",
    });
  };

  setAddress = (address) => {
    this.setState({to: address});

    Client.getAddress(address).then(data => {
      this.setState({
        toAccount: data ? data : null,
      });
    })
  };

  setNote = (note) => {
    this.setState({note});
  };

  handleTokenChange = (value) => {
      this.setState({ token: value },() =>{
          this.getSelectedTokenBalance();
      });

  }

  async getTRC20Tokens(){
      let {account} = this.props;
      let result = await xhr.get(API_URL+"/api/token_trc20?sort=issue_time&start=0&limit=50");
      let tokens20 = result.data.trc20_tokens;
          tokens20.map(async item =>{
              item.token20_name = item.name + '(' + item.symbol + ')';
              item.token_name_type = item.name + '-TRC20';
              let  contractInstance = await account.tronWeb.contract().at(item.contract_address);
              let  balanceData = await contractInstance.balanceOf(account.address).call();
              if(balanceData.balance){
                  item.balance = parseFloat(balanceData.balance.toString()) / Math.pow(10,item.decimals);
              }else{
                  item.balance = parseFloat(balanceData.toString()) / Math.pow(10,item.decimals);
              }
              return item
          });
          setTimeout(()=>{
              let tokens = _(tokens20)
                  .filter(tb => tb.balance > 0)
                  .sortBy(tb => tb.name)
                  .value();
              this.setState({
                  tokens20: tokens
              });
          },2000)

  }
  render() {

    let {intl, tokenBalances, account} = this.props;
    let {isLoading, sendStatus, modal, to, note, toAccount, token, amount, privateKey,tokens20} = this.state;
    tokenBalances = _(tokenBalances).filter(tb => tb.balance > 0).value();
    tokenBalances.map(item =>{
        item.token_name_type = item.name + '-TRC10';
        return item
    });
    let isToValid = to.length !== 0 && isAddressValid(to);
   // let isPrivateKeyValid = privateKey && privateKey.length === 64 && pkToAddress(privateKey) === account.address;
    let isAmountValid = this.isAmountValid();


    if (sendStatus === 'success') {
      return (
          <Fragment>
            <div className="alert alert-success text-center">
              {tu("successful_send")}
            </div>
            <div className="justify-content-center">
              <button className="btn btn-primary btn-block" onClick={this.resetForm}>
                {tu("make_another_transaction")}
              </button>
            </div>
          </Fragment>
      )
    }

    return (
        <form>
          {modal}
          {isLoading && <TronLoader/>}
          <div className="form-group">
            <label>{tu("to")}</label>
            <div className="input-group mb-3">
              <input type="text"
                     onChange={(ev) => this.setAddress(ev.target.value)}
                     className={"form-control " + (!isToValid ? "is-invalid" : "")}
                     value={to}/>
              <div className="invalid-feedback">
                {tu("fill_a_valid_address")}
                {/* tu("invalid_address") */}
              </div>
            </div>
          </div>
          {
            (toAccount && toAccount.name !== "") && <Alert color="info">
              <b>{toAccount.name}</b>
            </Alert>
          }
          <div className="form-group">
            <label>{tu("token")}</label>
            <div className="input-group mb-3"  style={{height:36}}>
              {/*<select*/}
                  {/*className="form-control"*/}
                  {/*onChange={(ev) => this.setState({token: ev.target.value})}*/}
                  {/*value={token}>*/}
                {/*{*/}
                  {/*tokenBalances.map((tokenBalance, index) => (*/}
                      {/*<SendOption key={index}*/}
                                  {/*name={tokenBalance.name}*/}
                                  {/*balance={tokenBalance.balance}/>*/}
                  {/*))*/}
                {/*}*/}
              {/*</select>*/}
              <Select
                  onChange={this.handleTokenChange}
                  value={token}
              >
                <OptGroup label={tu('TRC10_token')} key="TRC10">
                    {
                        tokenBalances.map((tokenBalance, index) => (
                            <Option value={tokenBalance.token_name_type} key={index}>
                                 {tokenBalance.name} ({tokenBalance.balance} {intl.formatMessage({id: "available"})})
                            </Option>
                        ))
                    }
                </OptGroup>

                <OptGroup label={tu('TRC20_token')} key="TRC20">
                    {
                        tokens20.map((token, index) => (
                            <Option value={token.token_name_type} key={index}>
                                {token.name} ({token.balance} {intl.formatMessage({id: "available"})})
                            </Option>
                        ))
                    }
                </OptGroup>
              </Select>
            </div>
          </div>
          <div className="form-group">
            <label>{tu("amount")}</label>
            <div className="input-group mb-3">
              <input type="number"
                     onChange={(ev) => this.setAmount(ev.target.value)}
                     className={"form-control " + (!isAmountValid ? "is-invalid" : "")}
                     value={amount}
                     placeholder='0.000000'/>
              <div className="input-group-append">
                <button className="btn btn-outline-secondary"
                        type="button"
                        onClick={this.setMaxAmount}>
                  MAX
                </button>
              </div>
              <div className="invalid-feedback">
                {tu("fill_a_valid_number")}
                {/* tu("insufficient_tokens") */}
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>{tu("note")}</label>
            <div className="input-group mb-3">
            <textarea
                onChange={(ev) => this.setNote(ev.target.value)}
                className={"form-control"}
                value={note}
            />
              <div className="invalid-feedback">
                {tu("fill_a_valid_address")}
                {/* tu("invalid_address") */}
              </div>
            </div>
          </div>
          {this.renderFooter()}
        </form>
    )
  }
}

function mapStateToProps(state) {
  return {
    account: state.app.account,
    tokenBalances: state.account.tokens,
  };
}

const mapDispatchToProps = {
  login,
  reloadWallet,
};

export default connect(mapStateToProps, mapDispatchToProps)(injectIntl(SendForm))
