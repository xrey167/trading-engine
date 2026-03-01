//+------------------------------------------------------------------+
//|                                                   Correlator.mq4 |
//|                                    Copyright 2017 by Dirk Hilger |
//|                                             https://www.mql5.com |
//+------------------------------------------------------------------+
#property copyright "Copyright 2017, Dirk Hilger"
#property link      "https://www.stereotrader.net"
#property version   "1.00"
#property strict
/*

   DESCRIPTION:
   
   Correlation overlay
*/

#property indicator_buffers 4
#property indicator_plots   4

//--- Bands
#property indicator_width1 2
#property indicator_width2 2
#property indicator_width3 2
#property indicator_width4 2


//--- Colored MA
#property indicator_label1  "Open"
#property indicator_label2  "Low"
#property indicator_label3  "High"
#property indicator_label4  "Close"

   

input color __e_clrclose = clrSteelBlue;
input color __e_clropen = C'0,128,0';
input color __e_clrlow = C'128,0,0';
input color __e_clrhigh = clrOrange;
input int   __e_width = 1;

//+------------------------------------------------------------------+
//| Include the API                                                  |
//+------------------------------------------------------------------+
#include <StereoTrader_API\StereoAPI.mqh>
//--- Remove the following lines if indicator shall not appear 
//    in a separate window
//#property indicator_separate_window
//#property indicator_height 48


//+------------------------------------------------------------------+
//| Declaration of StereoEA                                          |
//+------------------------------------------------------------------+
DECLARE_SEA_BEGIN("Correlator")
//+------------------------------------------------------------------+
//| Variables                                                        |
//+------------------------------------------------------------------+
double      m_c[];
double      m_o[];
double      m_h[];
double      m_l[];
//+------------------------------------------------------------------+
//| Objects                                                          |
//+------------------------------------------------------------------+
CSButton    m_sync;
CSEdit      m_sym;
CSNumEdit   m_adjust;
CBars       m_bars;     //--- Bars of foreign symbol
CSButton    m_open;
CSButton    m_low;
CSButton    m_high;
CSButton    m_close;
CSLabel     m_cval;
CSButton    m_calibrate;


//+------------------------------------------------------------------+
//| Initialization function                                          |
//+------------------------------------------------------------------+
SEA_CREATE
   {
      //--- Debug specific time? Specify day of begin and count of days
      //SEA_DEBUGRANGE(D'2017.01.01',14);
      SetIndexBuffer(0,m_o);
      ArraySetAsSeries(m_o,false);
      SetIndexBuffer(1,m_h);
      ArraySetAsSeries(m_h,false);
      SetIndexBuffer(2,m_l);
      ArraySetAsSeries(m_l,false);
      SetIndexBuffer(3,m_c);
      ArraySetAsSeries(m_c,false);
      _SetIndexStyle(0,"",DRAW_LINE,STYLE_SOLID,1,__e_clropen);
      _SetIndexStyle(1,"",DRAW_LINE,STYLE_SOLID,1,__e_clrhigh);
      _SetIndexStyle(2,"",DRAW_LINE,STYLE_SOLID,1,__e_clrlow);
      _SetIndexStyle(3,"",DRAW_LINE,STYLE_SOLID,1,__e_clrclose);
      
      
   }
SEA_INIT
   {
      //--- Optional initialization
      SetEveryTick();
      SetEvaluate(false);
      //SetOnCalculate(true,true);
      //SetRoom(4);
      //SetSignalMinDistance(10);
      //SetSignalRules(SEA_OPPOSITE_CLOSE,true);
      
      //--- Add elements to the panel
      int w=_Panel.ItemWidth();
      _Panel.ItemWidth(w*2);
      _Panel.AddEdit(m_sym,"Symbol");
      _Panel.ItemWidth(w);
      _Panel.AddNumLabel(m_cval,"Current",2);
      m_cval.ShowPlusSign(true);
      m_cval.AutoColor(0,_Host.clr_bear,_Host.clr_bull);
      _Panel.ItemWidth(32);
      _Panel.AddButton(m_open,"OHLC","O","O");
      _Panel.AddButton(m_high,"","H","H");
      _Panel.AddButton(m_low,"","L","L");
      _Panel.AddButton(m_close,"","C","C",true);
      _Panel.ItemWidth(w);
      _Panel.AddButton(m_sync,"Sync","By bars","By time");
      _Panel.AddButton(m_calibrate,"Calibration","Auto","Auto");
      _Panel.AddNumEdit(m_adjust,"",PRICE_INVALID,4);
      //--- Other settings
      
      //---
      
      
      //--- Done
      return true;
   }
//+------------------------------------------------------------------+
//| Optional deinitialization function                               |
//+------------------------------------------------------------------+
SEA_DEINIT
   {
   }
//+------------------------------------------------------------------+
//| Optional indication (drawing and calculations)                   |
//+------------------------------------------------------------------+
SEA_INDICATE
   {
      //--- Buffer vars
      static string symbol=NULL;
      static bool timesync=false;
      static bool display=false;
      static double adjust=1.0;
      
      static bool show_o=false;
      static bool show_l=false;
      static bool show_h=false;
      static bool show_c=false;
      
      //--- Optional initialization when panel has changed
      if (IsResetFired())
         {
         //--- Buffer values due to processing speed
         bool symbolchanged=symbol!=m_sym.Text();
         symbol=m_sym.Text();
         timesync=m_sync.IsChecked();
         
         if (symbol=="" || symbol==NULL)
            return;
         
         show_o=m_open.IsChecked();
         show_l=m_low.IsChecked();
         show_h=m_high.IsChecked();
         show_c=m_close.IsChecked();
         
         //--- Auto adjust when adjust value is not set
         if (m_adjust.IsEmpty() || symbolchanged || m_calibrate.IsChecked())
            {
            m_calibrate.Check(false);
            double c=_iClose(symbol,_TimeFrame,0);
            if (c>0)
               {
               adjust=_iClose(_SymbolName,_TimeFrame,0)/c;
               m_adjust.Value(adjust);
               }
            }
         else
            adjust=m_adjust.Value();   

            
         m_bars.SymbolName(symbol);
         m_bars.TimeFrame(_TimeFrame);
         }

      //--- Sync 2nd Bars object
      if (symbol=="" || symbol==NULL)
         return;

         
      bool islastbar=IsLastBar();

      //--- Show value
      double c2= (!timesync || islastbar) ? _iClose(symbol,_TimeFrame,_Shift)*adjust : m_bars.Close(_Time)*adjust;
      if (c2>0)
         {
         double v=(100-(_Price*100/c2));
         m_cval.Value(v);            
         }
      else
         {
         m_cval.Value(PRICE_INVALID);
         }

      //--- Display close
      if (!show_c)
         m_c[_Index]=EMPTY_VALUE;
      else
         m_c[_Index]=c2>0 ? c2 : EMPTY_VALUE;

      //--- Display low
      if (!show_l)
         m_l[_Index]=EMPTY_VALUE;
      else
         {
         double v=0;
         if (!timesync || islastbar)
            v=_iLow(symbol,_TimeFrame,_Shift)*adjust;
         else
            v=m_bars.Low(_Time)*adjust;
         m_l[_Index]=v>0 ? v : EMPTY_VALUE;
         }

      //--- Display high
      if (!show_h)
         m_h[_Index]=EMPTY_VALUE;
      else
         {
         double v=0;
         if (!timesync || islastbar)
            v=_iHigh(symbol,_TimeFrame,_Shift)*adjust;
         else
            v=m_bars.High(_Time)*adjust;
         m_h[_Index]=v>0 ? v : EMPTY_VALUE;
         }

      //--- Display open
      if (!show_o)
         m_o[_Index]=EMPTY_VALUE;
      else
         {
         double v=0;
         if (!timesync || islastbar)
            v=_iOpen(symbol,_TimeFrame,_Shift)*adjust;
         else
            v=m_bars.Open(_Time)*adjust;
         m_o[_Index]=v>0 ? v : EMPTY_VALUE;
         }


   }
//+------------------------------------------------------------------+
//| Evaluation (generation of signals)                               |
//+------------------------------------------------------------------+
SEA_EVALUATE
   {
      
   }      
//+------------------------------------------------------------------+
//| Reset (optional intialization of variables)                      |
//+------------------------------------------------------------------+
SEA_RESET
   {
   }   
//+------------------------------------------------------------------+
//| Declaration of StereoEA                                          |
//+------------------------------------------------------------------+
DECLARE_SEA_END
   