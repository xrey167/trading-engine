//+------------------------------------------------------------------+
//|                                                     ATR-Base.mq4 |
//|                                    Copyright 2015 by Dirk Hilger |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2017, Dirk Hilger"
#property link      "https://www.stereotrader.net"
#property version   "1.00"
#property strict
/*

   DESCRIPTION:
   
   This SEA adds ATR functionality to the Pool-Panel to use
   - ATR-Stops
   - ATR-TP
   - ATR-Trailing begin
   - ATR-Trailing distance

*/

//+------------------------------------------------------------------+
//| Include the API                                                  |
//+------------------------------------------------------------------+
#include <StereoTrader_API\StereoAPI.mqh>
//--- Remove the following lines if indicator shall not appear 
//    in a separate window
//#property indicator_separate_window
//#property indicator_height 48

//+----------------------------- ------------------------------------+
//| Input vars                                                       |
//+------------------------------------------------------------------+
input uint __e_barslimit = 1000;   // Limit history / max bars

//+------------------------------------------------------------------+
//| Declaration of StereoEA                                          |
//+------------------------------------------------------------------+
DECLARE_SEA_BEGIN("ATR-Base")
//+------------------------------------------------------------------+
//| Variables                                                        |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Objects                                                          |
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//| Initialization function                                          |
//+------------------------------------------------------------------+
SEA_INIT
   {
      SetProcessLimit(__e_barslimit);
      //--- Add the module
      //    The module is managed automatically
      AddModuleATR(false,true);      
      
      //--- Done
      return true;
   }
//+------------------------------------------------------------------+
//| Declaration of StereoEA                                          |
//+------------------------------------------------------------------+
DECLARE_SEA_END
   