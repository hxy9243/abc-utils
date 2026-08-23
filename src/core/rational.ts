/**
 * Exact Fractional Arithmetic & LCM/GCD utility for music timing.
 */
export class Rational {
  readonly num: number;
  readonly den: number;

  constructor(num: number, den: number = 1) {
    if (den === 0) {
      throw new Error('Denominator cannot be zero');
    }
    if (den < 0) {
      num = -num;
      den = -den;
    }
    const g = Rational.gcd(Math.abs(num), den);
    this.num = num / g;
    this.den = den / g;
  }

  static gcd(a: number, b: number): number {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    while (b) {
      const t = b;
      b = a % b;
      a = t;
    }
    return a || 1;
  }

  static lcm(a: number, b: number): number {
    a = Math.abs(Math.round(a));
    b = Math.abs(Math.round(b));
    if (a === 0 || b === 0) return 0;
    return (a * b) / Rational.gcd(a, b);
  }

  static zero(): Rational {
    return new Rational(0, 1);
  }

  static one(): Rational {
    return new Rational(1, 1);
  }

  static from(num: number, den: number = 1): Rational {
    return new Rational(num, den);
  }

  add(other: Rational | number): Rational {
    const o = typeof other === 'number' ? new Rational(other) : other;
    return new Rational(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  sub(other: Rational | number): Rational {
    const o = typeof other === 'number' ? new Rational(other) : other;
    return new Rational(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  mul(other: Rational | number): Rational {
    const o = typeof other === 'number' ? new Rational(other) : other;
    return new Rational(this.num * o.num, this.den * o.den);
  }

  div(other: Rational | number): Rational {
    const o = typeof other === 'number' ? new Rational(other) : other;
    if (o.num === 0) {
      throw new Error('Division by zero');
    }
    return new Rational(this.num * o.den, this.den * o.num);
  }

  compare(other: Rational | number): number {
    const o = typeof other === 'number' ? new Rational(other) : other;
    const diff = this.num * o.den - o.num * this.den;
    return diff < 0 ? -1 : diff > 0 ? 1 : 0;
  }

  equals(other: Rational | number): boolean {
    return this.compare(other) === 0;
  }

  toNumber(): number {
    return this.num / this.den;
  }

  toString(): string {
    return this.den === 1 ? `${this.num}` : `${this.num}/${this.den}`;
  }
}
