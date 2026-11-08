// Most-guessed PINs beyond the patterns checked below.
const COMMON_PINS = new Set(["1122", "1313", "2580", "0852", "1004", "2000", "6969", "1998", "1999"]);

const isWeakPin = ({ pin }: { pin: string }) => {
    const digits = pin.split("").map(Number);

    const isRepeated = digits.every((digit) => digit === digits[0]);
    const isAscending = digits.every((digit, i) => i === 0 || digit === digits[i - 1] + 1);
    const isDescending = digits.every((digit, i) => i === 0 || digit === digits[i - 1] - 1);
    const isRepeatingPair =
        pin.length % 2 === 0 && pin === pin.slice(0, 2).repeat(pin.length / 2);

    const isWeak =
        isRepeated || isAscending || isDescending || isRepeatingPair || COMMON_PINS.has(pin);

    return isWeak;
};

export default isWeakPin;
