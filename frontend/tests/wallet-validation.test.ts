import { expect, it } from 'vitest';
import { validateAmount, formatCoin } from '../src/features/wallet/validation';
it('validates integer Coin without losing precision', () => {
 for(const value of ['0','-1','1.5','abc','','01','9223372036854775808']) expect(validateAmount(value)).not.toBeNull();
 expect(validateAmount('9223372036854775807')).toBeNull();
 expect(validateAmount('500')).toBeNull();
 expect(formatCoin('9007199254740993')).toBe('9.007.199.254.740.993');
});
