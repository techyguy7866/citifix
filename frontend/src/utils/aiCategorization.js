export const categorizeIssue = (description, title) => {
  const text = `${title} ${description}`.toLowerCase();
  
  const categories = {
    'Roads': ['pothole', 'road', 'street', 'pavement', 'crack', 'damage', 'highway'],
    'Garbage': ['garbage', 'waste', 'trash', 'litter', 'dump', 'rubbish', 'bin'],
    'Water': ['water', 'leak', 'pipe', 'drainage', 'sewage', 'overflow', 'tap'],
    'Electricity': ['light', 'electricity', 'power', 'streetlight', 'lamp', 'wire', 'pole'],
    'Parks': ['park', 'garden', 'tree', 'playground', 'bench', 'green'],
    'Traffic': ['traffic', 'signal', 'sign', 'crossing', 'zebra', 'congestion'],
    'Other': []
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      return category;
    }
  }
  
  return 'Other';
};