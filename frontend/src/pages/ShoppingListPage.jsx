import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';

const PLATFORM_SEARCH_URLS = {
  Blinkit: "https://blinkit.com/search?q=",
  Zepto: "https://www.zeptonow.com/search?q=",
  BigBasket: "https://www.bigbasket.com/ps/?q="
};

const OrderModal = ({ isOpen, onClose, onConfirm, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl transform transition-all">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">🛒 Order Groceries</h2>
        <p className="text-gray-600 mb-6">
          Choose a platform to automate your cart. This will open a browser window and add items automatically.
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => onConfirm('blinkit')}
            className="bg-yellow-400 hover:bg-yellow-500 text-black py-4 rounded-xl font-bold border-2 border-transparent hover:border-yellow-600 transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">⚡</span>
            Blinkit
          </button>
          <button
            onClick={() => onConfirm('bigbasket')}
            className="bg-red-500 hover:bg-red-600 text-white py-4 rounded-xl font-bold border-2 border-transparent hover:border-red-700 transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🧺</span>
            BigBasket
          </button>
          <button
            onClick={() => onConfirm('zepto')}
            className="bg-purple-600 hover:bg-purple-700 text-white py-4 rounded-xl font-bold border-2 border-transparent hover:border-purple-800 transition flex flex-col items-center gap-2"
          >
            <span className="text-2xl">🚀</span>
            Zepto
          </button>
        </div>

        {loading && (
          <div className="text-center mb-4">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-gray-600 border-t-transparent mr-2"></div>
            <span className="text-sm text-gray-500">Launching automation...</span>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3 text-gray-500 hover:text-gray-700 font-medium"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const ShoppingListPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [mealPlan, setMealPlan] = useState(location.state?.mealPlan || null);
  const [priceComparison, setPriceComparison] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [pantry, setPantry] = useState({});
  const pantryKey = mealPlan?.id ? `pantry_${mealPlan.id}` : null;
  
  // Order Automation State
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const platforms = [
    { name: 'Blinkit', url: 'https://blinkit.com/', color: 'bg-yellow-500 hover:bg-yellow-600' },
    { name: 'Zepto', url: 'https://www.zepto.com/', color: 'bg-purple-500 hover:bg-purple-600' },
    { name: 'BigBasket', url: 'https://www.bigbasket.com/', color: 'bg-red-500 hover:bg-red-600' }
  ];

  useEffect(() => {
    if (!mealPlan) loadRecentPlan();
  }, []);

  useEffect(() => {
    if (!pantryKey) return;
    try {
      const saved = localStorage.getItem(pantryKey);
      if (saved) setPantry(JSON.parse(saved));
    } catch (e) {
      console.error('Failed to load pantry state:', e);
    }
  }, [pantryKey]);

  useEffect(() => {
    if (!pantryKey) return;
    try {
      localStorage.setItem(pantryKey, JSON.stringify(pantry));
    } catch (e) {
      console.error('Failed to save pantry state:', e);
    }
  }, [pantry, pantryKey]);

  const loadRecentPlan = async () => {
    setLoading(true);
    try {
      const response = await api.get('/meal-plans');
      if (response.data.mealPlans.length > 0) setMealPlan(response.data.mealPlans[0]);
    } catch (error) {
      console.error('Error loading meal plan:', error);
    } finally {
      setLoading(false);
    }
  };

  // ===========================
  // COPY 🛒 Shopping List
  // ===========================
  const copyShoppingList = () => {
    if (!mealPlan?.plan_data?.shoppingList) return;

    const listText = mealPlan.plan_data.shoppingList
      .map(item => `${item.item} (${item.qty}) - ₹${item.price}`)
      .join('\n');

    navigator.clipboard.writeText(listText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ===========================
  // OPEN PLATFORM WITH FIRST ITEM SEARCH
  // ===========================
  const openPlatform = (platformName, baseUrl) => {
    copyShoppingList();

    let targetUrl = baseUrl;
    const firstItem = mealPlan?.plan_data?.shoppingList?.[0]?.item;

    if (firstItem && PLATFORM_SEARCH_URLS[platformName]) {
      targetUrl = PLATFORM_SEARCH_URLS[platformName] + encodeURIComponent(firstItem);
    }

    window.open(targetUrl, '_blank');
  };

  // ===========================
  // COMPARE PRICES
  // ===========================
  const handleComparePrices = async () => {
    if (!mealPlan) return;

    setComparing(true);
    try {
      const skipItems = mealPlan.plan_data.shoppingList
        .map((item, index) => (pantry[index] ? item.item : null))
        .filter(Boolean);
      const response = await api.post('/price-comparison/compare', { skipItems });

      // The backend now returns { items, totals, recommendation, ... }
      // We need to transform the flat 'items' list back into a map for the table row display
      
      const comparisonMap = {};
      const backendTotals = response.data.totals || { blinkit: 0, zepto: 0, bigbasket: 0 };
      
      // Initialize map with all 🛒 Shopping List items
      mealPlan.plan_data.shoppingList.forEach(listItem => {
          comparisonMap[listItem.item] = { 
              item: listItem.item, 
              blinkit: 0, 
              zepto: 0, 
              bigbasket: 0 
          };
      });

      // Fill in price data from response
      if (Array.isArray(response.data.items)) {
          response.data.items.forEach(item => {
            const name = item.product_name;
            if (!comparisonMap[name]) {
                 comparisonMap[name] = { item: name, blinkit: 0, zepto: 0, bigbasket: 0 };
            }
    
            // Map price AND metadata
            const platformKey = item.platform.toLowerCase();
            if (['blinkit', 'zepto', 'bigbasket', 'instamart'].includes(platformKey)) {
                comparisonMap[name][platformKey] = item.price;
                
                if (!comparisonMap[name].metadata) comparisonMap[name].metadata = {};
                comparisonMap[name].metadata[platformKey] = {
                    isEstimate: item.isEstimate,
                    matchedName: item.matchedName,
                    sourceUnit: item.sourceUnit
                };
            }
          });
      }

      setPriceComparison({
        comparison: Object.values(comparisonMap),
        totals: backendTotals,
        recommendation: response.data.recommendation || '💡 Buy from the platform with the lowest total cost!'
      });

    } catch (error) {
      console.error('Error comparing prices:', error);
      setNotice({ type: 'error', message: 'Failed to compare prices. Please try again.' });
    } finally {
      setComparing(false);
    }
  };

  // ===========================
  // ORDER AUTOMATION
  // ===========================
  const handleOrder = async (platform) => {
    setOrdering(true);
    try {
      const skipItems = mealPlan.plan_data.shoppingList
        .map((item, index) => (pantry[index] ? item.item : null))
        .filter(Boolean);
      // Trigger backend automation
      const response = await api.post('/cart/add', {
        platform: platform,
        mealPlanId: mealPlan.id,
        skipItems
      });

      if (response.data.success) {
        const cartUrl = platform === 'blinkit' ? 'https://blinkit.com' 
                     : platform === 'zepto' ? 'https://www.zeptonow.com' 
                     : platform === 'bigbasket' ? 'https://www.bigbasket.com/basket/?ver=1'
                     : 'https://www.swiggy.com/instamart';

        setNotice({ 
            type: 'success', 
            message: `Added ${response.data.itemsAdded} items to your ${platform} cart. Click here to review: ${cartUrl}`,
            cartUrl: cartUrl
        });
        setShowOrderModal(false);
      } else {
        setNotice({ type: 'error', message: 'Failed to add items to cart: ' + response.data.error });
      }
    } catch (error) {
      console.error('Order automation error:', error);
      setNotice({ type: 'error', message: 'Failed to start order automation. Please ensure backend is running.' });
    } finally {
      setOrdering(false);
    }
  };

  const handleCancelOrder = async () => {
      setShowOrderModal(false);
      // If currently ordering, try to stop backend process
      if (ordering) {
          try {
              await api.post('/cart/cancel');
              // console.log('Automation stopped');
          } catch(e) {
              console.error('Failed to stop automation:', e);
          }
      }
      setOrdering(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-orange-600 border-t-transparent"></div>
      </div>
    );
  }

  if (!mealPlan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center max-w-md">
          <div className="text-6xl mb-4">🛒</div>
          <h2 className="text-2xl font-bold mb-4">No 🛒 Shopping List Yet</h2>
          <p className="text-gray-600 mb-6">Generate a meal plan first to see your 🛒 Shopping List</p>
          <button
            onClick={() => navigate('/weekly-planner')}
            className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition"
          >
            Go to Meal Planner
          </button>
        </div>
      </div>
    );
  }

  const displayTotal = mealPlan.plan_data.shoppingList?.reduce((sum, item, index) => {
    if (pantry[index]) return sum;
    return sum + (item.price || 0);
  }, 0) || 0;

  const getCategory = (name) => {
    const n = (name || '').toLowerCase();
    if (/(milk|curd|yogurt|paneer|cheese|butter|ghee|cream)/.test(n)) return 'Dairy';
    if (/(tomato|onion|potato|spinach|palak|capsicum|carrot|cabbage|cauliflower|gourd|beans|peas|bhindi|brinjal|mint|coriander|curry leaves)/.test(n)) return 'Produce';
    if (/(atta|flour|maida|rice|poha|rava|sooji|semolina|dal|lentil|chana|rajma|urad|moong|toor|masoor|sugar|salt)/.test(n)) return 'Pantry Staples';
    if (/(oil|mustard|jeera|cumin|haldi|turmeric|chilli|pepper|garam masala|coriander powder|spice|masala)/.test(n)) return 'Spices & Oils';
    if (/(bread|pav|pasta|noodles|biscuit|cookie|jam|sauce|ketchup|pickle|papad)/.test(n)) return 'Packaged';
    if (/(egg|chicken|fish|mutton|meat)/.test(n)) return 'Protein';
    return 'Other';
  };

  const formatQty = (qty) => {
    if (qty == null) return '';
    const raw = String(qty).trim();
    if (!raw) return '';
    const hasLetters = /[a-z]/i.test(raw);
    if (hasLetters) return raw;
    const num = parseFloat(raw);
    if (Number.isNaN(num)) return raw;
    return `${raw} pcs`;
  };

  const groupedItems = (mealPlan.plan_data.shoppingList || []).reduce((acc, item, index) => {
    const category = getCategory(item.item);
    if (!acc[category]) acc[category] = [];
    acc[category].push({ ...item, index });
    return acc;
  }, {});

  // Helper to render price cell
  const renderPriceCell = (price, metadata) => {
      if (!price) return <td className="text-right p-3 text-gray-400">-</td>;
      const isEstimate = metadata?.isEstimate ?? true;
      const matchedName = metadata?.matchedName;
      
      return (
          <td className="text-right p-3">
              <span className={`font-medium ${isEstimate ? 'text-orange-600' : 'text-green-700'}`}>
                  ₹{price}
              </span>
              {isEstimate ? (
                  <div className="text-[9px] text-gray-500 leading-tight">
                    {matchedName || 'Estimate'}
                  </div>
              ) : (
                  <div className="text-[9px] text-green-600 font-bold leading-tight truncate max-w-[80px]" title={matchedName}>
                    {matchedName || 'Verified'}
                  </div>
              )}
          </td>
      );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-green-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <button
            onClick={() => navigate('/weekly-planner')}
            className="text-orange-600 hover:text-orange-700 mb-4"
          >
            ← Back to Weekly Planner
          </button>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">🛒 Shopping List</h1>
          <p className="text-gray-600">
            Week of {new Date(mealPlan.week_start_date).toLocaleDateString()}
          </p>
        </div>

        {/* 🛒 Shopping List */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          {notice && (
            <div className={`mb-6 border-2 rounded-lg px-4 py-3 flex justify-between items-center ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
              <p>{notice.message}</p>
              {notice.cartUrl && (
                  <a 
                    href={notice.cartUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm font-bold ml-4 hover:bg-green-700"
                  >
                    Open Cart
                  </a>
              )}
            </div>
          )}
          {mealPlan.plan_data.shoppingListStale && (
            <div className="mb-6 border-2 rounded-lg px-4 py-3 bg-yellow-50 border-yellow-200 text-yellow-700">
              🛒 Shopping List may be outdated due to meal replacement. Regenerate the plan for an accurate list.
            </div>
          )}
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">📋 Items to Buy</h2>
            <div className="flex gap-2">
                <button
                  onClick={() => setShowOrderModal(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-bold shadow transition flex items-center gap-2"
                >
                  <span>🛒</span> Order Now
                </button>
                <button
                  onClick={copyShoppingList}
                  className={`px-4 py-2 rounded-lg font-medium transition ${ 
                    copied 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copied ? '✓ Copied!' : '📋 Copy List'}
                </button>
            </div>
          </div>

          <div className="space-y-6 mb-6">
            {Object.entries(groupedItems).map(([category, items]) => (
              <div key={category}>
                <h3 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-2">{category}</h3>
                <div className="space-y-3">
                  {items.map((item) => (
                    <div key={item.index} className={`flex justify-between items-center bg-gray-50 p-4 rounded-lg border-2 border-gray-200 ${pantry[item.index] ? 'opacity-60' : ''}`}>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">✓</span>
                        <div>
                          <p className="font-semibold text-gray-800">{item.item}</p>
                          <p className="text-sm text-gray-600">{formatQty(item.qty)}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-lg text-gray-800">₹{item.price}</span>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">
                          {priceComparison && priceComparison.comparison?.some(c => c.item === item.item && Object.values(c.isEstimate || {}).some(v => v === false))
                            ? 'Real Price Available'
                            : 'Estimated Price'}
                        </p>
                        <button
                          onClick={() => setPantry(prev => ({ ...prev, [item.index]: !prev[item.index] }))}
                          className={`mt-2 text-xs px-2 py-1 rounded-full border ${pantry[item.index] ? 'bg-green-100 border-green-300 text-green-700' : 'bg-white border-gray-300 text-gray-600'}`}
                        >
                          {pantry[item.index] ? 'Have it' : 'Need it'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t-2 border-gray-300 pt-6 flex justify-between items-center">
            <span className="text-2xl font-bold text-gray-800">{priceComparison ? 'Total Cost' : 'Total Estimated Cost'}</span>
            <span className="text-3xl font-bold text-green-600">₹{displayTotal}</span>
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Note: Prices are AI-based estimates and may be approximate.
          </p>
        </div>


        {/* Compare Prices Button */}
        <button
          onClick={handleComparePrices}
          disabled={comparing}
          className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg mb-8 transition shadow-lg"
        >
          {comparing ? (
            <>
              <span className="inline-block animate-spin mr-2">⚙️</span>
              Comparing Prices...
            </>
          ) : (
            '💰 Compare Prices Across Platforms'
          )}
        </button>

        {/* 💰 Price Comparison Table */}
        {priceComparison && (
          <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-bold mb-6">💰 Price Comparison</h2>
            
            <div className="overflow-x-auto mb-6">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-100 border-b-2 border-gray-300">
                    <th className="text-left p-3 font-bold">Item</th>
                    <th className="text-right p-3 font-bold">Blinkit</th>
                    <th className="text-right p-3 font-bold">Zepto</th>
                    <th className="text-right p-3 font-bold">BigBasket</th>
                  </tr>
                </thead>
                <tbody>
                  {priceComparison.comparison?.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="p-3">{item.item}</td>
                      {renderPriceCell(item.blinkit, item.metadata?.blinkit)}
                      {renderPriceCell(item.zepto, item.metadata?.zepto)}
                      {renderPriceCell(item.bigbasket, item.metadata?.bigbasket)}
                    </tr>
                  ))}
                  <tr className="bg-gray-100 font-bold border-t-2 border-gray-300">
                    <td className="p-3">TOTAL</td>
                    <td className="text-right p-3">₹{priceComparison.totals.blinkit}</td>
                    <td className="text-right p-3">₹{priceComparison.totals.zepto}</td>
                    <td className="text-right p-3">₹{priceComparison.totals.bigbasket}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-6">
              <p className="text-green-800 font-medium">
                {priceComparison.recommendation}
              </p>
            </div>

            <h3 className="font-bold mb-4">🛒 Shop Now:</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {platforms.map((platform, index) => (
                <button
                  key={index}
                  onClick={() => openPlatform(platform.name, platform.url)}
                  className={`${platform.color} text-white text-center py-4 rounded-lg font-bold transition shadow-md hover:shadow-lg`}
                >
                  {platform.name} →
                </button>
              ))}
            </div>
            <p className="text-sm text-gray-500 text-center mt-4">
              💡 Shopping list auto-copied! Paste in app or add items manually
            </p>
          </div>
        )}

        {/* Order Modal */}
        <OrderModal 
            isOpen={showOrderModal}
            onClose={handleCancelOrder} // Use the new handler
            onConfirm={handleOrder}
            loading={ordering}
        />
      </div>
    </div>
  );
};

export default ShoppingListPage;

