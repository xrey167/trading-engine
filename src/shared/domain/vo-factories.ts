// Value-object factory helpers — ported from quant-lib/domain
// These provide sensible defaults so tests only need to specify the fields that matter.
import type { PositionInfoVO, DealInfoVO, HistoryOrderInfoVO } from './position.js';

export const PositionVOFactory = {
  make(overrides: Partial<PositionInfoVO> & Pick<PositionInfoVO, 'userId' | 'symbol'>): PositionInfoVO {
    const defaults: PositionInfoVO = {
      ticket:         0,
      userId:         overrides.userId,
      symbol:         overrides.symbol,
      type:           'BUY',
      magic:          0,
      identifier:     0,
      time:           new Date().toISOString(),
      priceOpen:      0,
      priceCurrent:   0,
      stopLoss:       0,
      takeProfit:     0,
      priceStopLimit: 0,
      volume:         0,
      commission:     0,
      swap:           0,
      profit:         0,
      comment:        '',
      externalId:     '',
      reason:         0,
    };
    return { ...defaults, ...overrides };
  },
};

export const DealInfoVOFactory = {
  make(overrides: Partial<DealInfoVO> & Pick<DealInfoVO, 'userId' | 'symbol'>): DealInfoVO {
    const defaults: DealInfoVO = {
      ticket:     0,
      userId:     overrides.userId,
      order:      0,
      positionId: 0,
      symbol:     overrides.symbol,
      type:       'BUY',
      entry:      'IN',
      volume:     0,
      price:      0,
      commission: 0,
      swap:       0,
      profit:     0,
      time:       new Date().toISOString(),
      comment:    '',
    };
    return { ...defaults, ...overrides };
  },
};

export const OrderVOFactory = {
  make(overrides: Partial<HistoryOrderInfoVO> & Pick<HistoryOrderInfoVO, 'userId' | 'symbol'>): HistoryOrderInfoVO {
    const defaults: HistoryOrderInfoVO = {
      ticket:        0,
      userId:        overrides.userId,
      symbol:        overrides.symbol,
      type:          'BUY',
      state:         'FILLED',
      volumeInitial: 0,
      volumeCurrent: 0,
      priceOpen:     0,
      stopLoss:      0,
      takeProfit:    0,
      timeSetup:     new Date().toISOString(),
      timeDone:      new Date().toISOString(),
      comment:       '',
    };
    return { ...defaults, ...overrides };
  },
};
