import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PinPad } from '../features/applock/PinPad';

describe('PinPad', () => {
  it('raqam bosilganda qiymat qo\'shiladi', () => {
    const onChange = vi.fn();
    render(<PinPad value="12" onChange={onChange} />);
    fireEvent.click(screen.getByText('7'));
    expect(onChange).toHaveBeenCalledWith('127');
  });
  it('o\'chirish tugmasi oxirgi raqamni olib tashlaydi', () => {
    const onChange = vi.fn();
    render(<PinPad value="123" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('delete'));
    expect(onChange).toHaveBeenCalledWith('12');
  });
  it('4 ta raqamdan ortiq kiritilmaydi', () => {
    const onChange = vi.fn();
    render(<PinPad value="1234" onChange={onChange} />);
    fireEvent.click(screen.getByText('5'));
    expect(onChange).not.toHaveBeenCalled();
  });
  it('barmoq izi tugmasi faqat yoqilganda ko\'rinadi', () => {
    const { rerender } = render(<PinPad value="" onChange={() => undefined} />);
    expect(screen.queryByLabelText('fingerprint')).toBeNull();
    rerender(<PinPad value="" onChange={() => undefined} onBiometric={() => undefined} />);
    expect(screen.getByLabelText('fingerprint')).toBeTruthy();
  });
});
