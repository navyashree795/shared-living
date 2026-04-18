export const detectCategory = (title: string): string => {
  const t = title.toLowerCase();
  
  if (t.includes('grocer') || t.includes('food') || t.includes('snack') || t.includes('zomato') || t.includes('swiggy') || t.includes('milk') || t.includes('eat')) {
    return 'Groceries & Food';
  }
  
  if (t.includes('wifi') || t.includes('internet') || t.includes('electric') || t.includes('power') || t.includes('water') || t.includes('bill') || t.includes('utilit')) {
    return 'Utilities';
  }
  
  if (t.includes('rent') || t.includes('house') || t.includes('maid') || t.includes('clean')) {
    return 'Housing';
  }
  
  if (t.includes('movie') || t.includes('party') || t.includes('fun') || t.includes('drink') || t.includes('alcohol') || t.includes('trip')) {
    return 'Entertainment';
  }
  
  if (t.includes('travel') || t.includes('cab') || t.includes('uber') || t.includes('ola') || t.includes('petrol') || t.includes('gas') || t.includes('transit')) {
    return 'Transportation';
  }

  return 'General';
};

export const getCategoryIcon = (category: string | undefined): any => {
  switch (category) {
    case 'Groceries & Food':
      return 'fastfood';
    case 'Utilities':
      return 'bolt';
    case 'Housing':
      return 'house';
    case 'Entertainment':
      return 'celebration';
    case 'Transportation':
      return 'directions-car';
    case 'General':
    default:
      return 'receipt-long';
  }
};
