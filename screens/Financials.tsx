    if (!saved) { setPaymentError(db.getLastDbError() || (isAr ? 'تعذر حفظ الدفعة. لم يتم اعتمادها.' : 'Could not save payment. It was not recorded.')); setPaymentSaving(false); return; }
    setPaymentAmount(''); setPaymentRef(''); setSelectedInvIds(new Set());
    setShowPaymentModal(false); setPaymentSaving(false); refreshData();
  };

  const visibleCustomers = useMemo(() => {
    const q = normalizeCustomerName(customerSearch);
    if (!q) return customers;
    return customers.filter(customer => {
      const ops = operations.filter(o => o.customerId === customer.id || (!o.customerId && [customer.companyName, customer.name].some(name => normalizeCustomerName(name) === normalizeCustomerName(o.customerName))));
      const customerInvoices = invoices.filter(invoice => belongsToCustomer(invoice, customer));
      const customerPayments = payments.filter(payment => payment.customerId === customer.id);
      return [customer.name, customer.companyName, customer.email, customer.id,
        ...customerInvoices.flatMap(invoice => [invoice.id, invoice.invoiceNo, invoice.bookingNumber, ...(invoice.containerNumbers || [])]),
        ...ops.flatMap(op => [op.bookingNumber, op.containerNumber, op.gensetNumber]),
        ...customerPayments.flatMap(payment => [payment.reference, payment.id])]
        .some(value => normalizeCustomerName(String(value || '')).includes(q));
    });
  }, [customers, customerSearch, invoices, operations]);

  const visiblePayments = useMemo(() => {
    const q = normalizeCustomerName(paymentSearch);
    return [...payments]
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter(payment => {
        const customer = users.find(user => user.id === payment.customerId);
        const fields = [payment.customerName, customer?.companyName, customer?.name, payment.date, payment.reference, payment.id, payment.type, payment.amount];
        return !q || fields.some(value => normalizeCustomerName(String(value ?? '')).includes(q));
      });
  }, [payments, paymentSearch, users]);
