import {describe,expect,it} from 'vitest';
import {numericInputNumber,numericInputValue} from '../src/lib/numeric-input';

describe('editable numeric formatting',()=>{
 it.each([
  ['12.00000000','12'],['13.00000','13'],['12.500000','12.5'],['0.25000000','0.25'],['1000.00000000','1000'],['1000.75000000','1000.75'],
 ])('formats %s as %s without changing its value',(input,expected)=>expect(numericInputValue(input)).toBe(expected));
 it('scales percentages without binary floating-point noise',()=>expect(numericInputValue(.12,100)).toBe('12'));
 it('keeps precise decimal input values',()=>expect(numericInputValue('999999999999.12345678')).toBe('999999999999.12345678'));
 it('converts scaled drafts back to calculation values',()=>expect(numericInputNumber('12.5',100)).toBe(.125));
 it('keeps blank and intermediate drafts out of calculations',()=>{expect(numericInputNumber('')).toBeNaN();expect(numericInputNumber('1.')).toBe(1);});
});
