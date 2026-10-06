// Supabase 프로젝트의 URL과 anon 키를 따옴표 안에 직접 입력하세요.
const SUPABASE_URL = 'https://akznhynguodurhrzueud.supabase.co';
const SUPABASE_KEY = 'sb_publishable_cc6VkFWitjUnoDqEzf1IGA_ZERNJA8k';

// 두 설정값을 입력한 경우에만 Supabase 클라이언트를 생성합니다.
const supabaseClient = SUPABASE_URL && SUPABASE_KEY
  ? supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// HTML에 있는 각 입력 요소를 ID와 이름으로 가져옵니다.
const orderForm = document.getElementById('order-form');
const customerNameInput = document.getElementById('customer-name');
const customerPhoneInput = document.getElementById('customer-phone');
const beverageSelect = document.getElementById('beverage-select');
const quantityInput = document.getElementById('quantity');
const estimatedPrice = document.getElementById('estimated-price');
const orderConfirmation = document.getElementById('order-confirmation');
const orderTab = document.getElementById('order-tab');
const historyTab = document.getElementById('history-tab');
const orderPanel = document.getElementById('order-panel');
const historyPanel = document.getElementById('history-panel');
const orderCount = document.getElementById('order-count');
const ordersList = document.getElementById('orders-list');
const emptyOrders = document.getElementById('empty-orders');
const ordersSummary = document.getElementById('orders-summary');
const ordersTotal = document.getElementById('orders-total');
const clearOrdersButton = document.getElementById('clear-orders-btn');

// 주문은 배열에 접수 순서대로 저장하고, 새 주문은 맨 앞에 넣습니다.
const orders = [];
let nextOrderNumber = 1;

// 선택된 음료, 사이즈, 추가 옵션 가격을 더한 뒤 수량을 곱합니다.
// 음료를 고르지 않았다면 다른 항목을 선택했어도 예상 금액은 0원입니다.
function calculateTotal() {
  if (!beverageSelect.value) {
    return 0;
  }

  const beveragePrice = Number(beverageSelect.selectedOptions[0].dataset.price) || 0;
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');
  const sizePrice = selectedSize ? Number(selectedSize.dataset.price) || 0 : 0;
  const selectedOptions = orderForm.querySelectorAll('input[name="option"]:checked');

  // 체크된 추가 옵션들의 data-price 값을 모두 합칩니다.
  const optionsPrice = Array.from(selectedOptions).reduce((total, option) => {
    return total + (Number(option.dataset.price) || 0);
  }, 0);

  // 수량이 비어 있으면 기본 수량인 1잔으로 계산합니다.
  const quantity = Number(quantityInput.value) || 1;

  return (beveragePrice + sizePrice + optionsPrice) * quantity;
}

// 계산 결과를 천 단위 쉼표 형식으로 예상 금액 영역에 표시합니다.
function updateEstimatedPrice() {
  estimatedPrice.textContent = calculateTotal().toLocaleString('ko-KR');
}

// 탭 버튼 상태와 각 화면의 표시 여부를 함께 바꿉니다.
function showTab(tabName) {
  const isOrderTab = tabName === 'order';

  orderTab.classList.toggle('is-active', isOrderTab);
  orderTab.setAttribute('aria-selected', String(isOrderTab));
  historyTab.classList.toggle('is-active', !isOrderTab);
  historyTab.setAttribute('aria-selected', String(!isOrderTab));
  orderPanel.classList.toggle('hidden', !isOrderTab);
  historyPanel.classList.toggle('hidden', isOrderTab);
}

// 주문 한 건을 카드 형태로 만들고, 모든 문구는 textContent로 넣습니다.
function createOrderCard(order) {
  const card = document.createElement('article');
  card.className = 'order-card';

  const cardHeader = document.createElement('div');
  cardHeader.className = 'order-card-header';

  const title = document.createElement('p');
  title.className = 'order-card-title';
  title.textContent = `#${order.orderNumber} ${order.customerName}님 · ${order.amount.toLocaleString('ko-KR')}원`;

  const cancelButton = document.createElement('button');
  cancelButton.className = 'order-cancel-button';
  cancelButton.type = 'button';
  cancelButton.textContent = '취소';
  cancelButton.dataset.orderNumber = String(order.orderNumber);

  cardHeader.append(title, cancelButton);

  const details = document.createElement('p');
  details.className = 'order-card-details';
  const optionSummary = order.options.length > 0 ? ` (${order.options.join(', ')})` : '';
  details.textContent = `${order.beverage} ${order.size}사이즈${optionSummary} ${order.quantity}잔`;

  const meta = document.createElement('p');
  meta.className = 'order-card-meta';
  const metaParts = [];
  if (order.requests) {
    metaParts.push(`요청사항: ${order.requests}`);
  }
  metaParts.push(new Date(order.orderedAt).toLocaleString('ko-KR'));
  meta.textContent = metaParts.join(' · ');

  card.append(cardHeader, details, meta);
  return card;
}

// 주문 배열을 화면에 다시 그리고 건수와 전체 금액을 갱신합니다.
function renderOrders() {
  ordersList.replaceChildren();
  orderCount.textContent = String(orders.length);

  let totalAmount = 0;
  orders.forEach((order) => {
    totalAmount += order.amount;
    ordersList.appendChild(createOrderCard(order));
  });

  const hasOrders = orders.length > 0;
  emptyOrders.classList.toggle('hidden', hasOrders);
  ordersSummary.classList.toggle('hidden', !hasOrders);
  ordersTotal.textContent = `총 주문 금액: ${totalAmount.toLocaleString('ko-KR')}원 (${orders.length}건)`;
}

// 입력, 선택, 체크가 바뀔 때마다 예상 금액을 다시 계산합니다.
orderForm.addEventListener('input', updateEstimatedPrice);
orderForm.addEventListener('change', updateEstimatedPrice);

// 주문 버튼을 누르면 필수 항목을 확인하고 먼저 Supabase에 저장합니다.
orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const customerName = customerNameInput.value.trim();
  if (!customerName) {
    alert('이름을 입력해주세요');
    customerNameInput.focus();
    return;
  }

  if (!beverageSelect.value) {
    alert('음료를 선택해주세요');
    beverageSelect.focus();
    return;
  }

  const selectedBeverage = beverageSelect.selectedOptions[0];
  const beverageName = selectedBeverage.textContent.replace(/\s*[\d,]+원$/, '').trim();
  const selectedSize = orderForm.querySelector('input[name="size"]:checked');
  const sizeName = selectedSize ? `${selectedSize.value}사이즈` : '';
  const selectedOptions = orderForm.querySelectorAll('input[name="option"]:checked');

  // 추가 옵션 이름은 연결된 label에서 가격 부분을 제외해 가져옵니다.
  const optionNames = Array.from(selectedOptions).map((option) => {
    const optionLabel = orderForm.querySelector(`label[for="${option.id}"]`);
    return optionLabel.textContent.replace(/\s*\+?[\d,]+원$/, '').trim();
  });

  // 선택한 옵션이 있을 때만 괄호 부분을 주문 문구에 붙입니다.
  const optionSummary = optionNames.length > 0 ? ` (${optionNames.join(', ')})` : '';
  const quantity = Number(quantityInput.value) || 1;
  const totalAmount = calculateTotal();
  const total = totalAmount.toLocaleString('ko-KR');
  const submitButton = document.getElementById('submit-btn');

  // 저장하는 동안 버튼을 잠가 중복 주문 전송을 막습니다.
  submitButton.disabled = true;

  try {
    if (!supabaseClient) {
      throw new Error('SUPABASE_URL과 SUPABASE_KEY를 먼저 입력해주세요.');
    }

    // 테이블 열 이름에 맞춰 주문 정보를 만들어 Supabase에 저장합니다.
    const orderData = {
      customer_name: customerName,
      phone: customerPhoneInput.value.trim(),
      drink: beverageName,
      drink_price: Number(selectedBeverage.dataset.price) || 0,
      size: selectedSize ? selectedSize.value : 'M',
      options: optionNames,
      quantity,
      request: document.getElementById('special-requests').value.trim(),
      total_price: totalAmount
    };

    const { error } = await supabaseClient
      .from('cafe_menu03')
      .insert([orderData]);

    if (error) {
      throw error;
    }

    // 저장이 성공한 주문만 화면의 주문 내역 배열에도 추가합니다.
    const order = {
      orderNumber: nextOrderNumber,
      customerName,
      beverage: beverageName,
      size: selectedSize ? selectedSize.value : 'M',
      options: optionNames,
      quantity,
      requests: orderData.request,
      amount: totalAmount,
      orderedAt: new Date().toISOString()
    };
    nextOrderNumber += 1;
    orders.unshift(order);
    renderOrders();

    orderConfirmation.textContent = `${customerName}님, ${beverageName} ${sizeName}${optionSummary} ${quantity}잔, 총 ${total}원 주문이 접수되었습니다!`;
    orderConfirmation.hidden = false;
    orderConfirmation.classList.remove('is-error');

    // 주문이 정상 접수되면 안내 문구 위로 고래가 지나가도록 요소를 추가합니다.
    const whale = document.createElement('span');
    whale.className = 'whale-animation';
    whale.textContent = '🐋';
    whale.setAttribute('aria-hidden', 'true');
    orderConfirmation.appendChild(whale);
  } catch (error) {
    // 저장 실패 원인은 개발자 도구 콘솔에 남기고 손님에게는 짧게 안내합니다.
    console.error('Supabase 주문 저장 오류:', error);
    alert('주문 저장에 실패했어요');
  } finally {
    // 성공 또는 실패와 관계없이 주문하기 버튼을 다시 사용할 수 있게 합니다.
    submitButton.disabled = false;
  }
});

// 탭을 누르면 해당 화면만 보이도록 전환합니다.
orderTab.addEventListener('click', () => showTab('order'));
historyTab.addEventListener('click', () => showTab('history'));

// 취소 버튼을 누르면 확인을 받은 뒤 해당 주문 한 건만 배열에서 지웁니다.
ordersList.addEventListener('click', (event) => {
  const cancelButton = event.target.closest('.order-cancel-button');
  if (!cancelButton) {
    return;
  }

  const orderNumber = Number(cancelButton.dataset.orderNumber);
  const orderIndex = orders.findIndex((order) => order.orderNumber === orderNumber);
  if (orderIndex === -1 || !confirm(`주문 #${orderNumber}을(를) 취소할까요?`)) {
    return;
  }

  orders.splice(orderIndex, 1);
  renderOrders();
});

// 전체 삭제도 확인창을 거쳐 주문 배열과 목록을 비웁니다.
clearOrdersButton.addEventListener('click', () => {
  if (orders.length === 0 || !confirm('주문 내역을 모두 지울까요?')) {
    return;
  }

  orders.length = 0;
  renderOrders();
});

// 다시 작성 버튼을 누르면 폼의 기본값(M 사이즈, 수량 1)으로 돌아갑니다.
orderForm.addEventListener('reset', () => {
  estimatedPrice.textContent = '0';
  orderConfirmation.textContent = '';
  orderConfirmation.hidden = true;
  orderConfirmation.classList.remove('is-error');
});

// 페이지가 열릴 때도 HTML의 현재 선택값을 기준으로 금액을 표시합니다.
updateEstimatedPrice();
renderOrders();