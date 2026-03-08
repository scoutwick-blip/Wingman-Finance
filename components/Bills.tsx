import React, { useState, useMemo } from 'react';
import { Bill, BillStatus, Category, RecurringFrequency, Transaction, NotificationType, Account } from '../types';
import { Calendar, Bell, Check, AlertTriangle, Plus, Edit2, Trash2, DollarSign, Zap } from 'lucide-react';

interface BillsProps {
  bills: Bill[];
  categories: Category[];
  accounts: Account[];
  transactions: Transaction[];
  currency: string;
  onAddBill: (bill: Bill) => void;
  onEditBill: (bill: Bill) => void;
  onDeleteBill: (billId: string) => void;
  onPayBill: (bill: Bill, transactionId: string) => void;
  onAddNotification: (type: NotificationType, title: string, message: string) => void;
}

export default function Bills({
  bills,
  categories,
  accounts,
  transactions,
  currency,
  onAddBill,
  onEditBill,
  onDeleteBill,
  onPayBill,
  onAddNotification
}: BillsProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    dueDate: '',
    categoryId: categories[0]?.id || '',
    accountId: accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
    isRecurring: false,
    frequency: RecurringFrequency.MONTHLY,
    notes: ''
  });

  // Calculate bill status
  const getBillStatus = (bill: Bill): BillStatus => {
    if (bill.status === BillStatus.PAID) return BillStatus.PAID;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(bill.dueDate);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return BillStatus.OVERDUE;
    if (diffDays <= 3) return BillStatus.DUE_SOON;
    return BillStatus.UPCOMING;
  };

  // Group bills by status
  const billsByStatus = useMemo(() => {
    const grouped = {
      overdue: [] as Bill[],
      dueSoon: [] as Bill[],
      upcoming: [] as Bill[],
      paid: [] as Bill[]
    };

    bills.forEach(bill => {
      const status = getBillStatus(bill);
      if (status === BillStatus.OVERDUE) grouped.overdue.push(bill);
      else if (status === BillStatus.DUE_SOON) grouped.dueSoon.push(bill);
      else if (status === BillStatus.PAID) grouped.paid.push(bill);
      else grouped.upcoming.push(bill);
    });

    // Sort each group by due date
    Object.values(grouped).forEach(group => {
      group.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    });

    return grouped;
  }, [bills]);

  // Payment streak — count consecutive paid bills with no overdue in between
  const paymentStreak = useMemo(() => {
    const paidBills = bills
      .filter(b => b.status === BillStatus.PAID && b.lastPaidDate)
      .sort((a, b) => new Date(b.lastPaidDate!).getTime() - new Date(a.lastPaidDate!).getTime());

    let streak = paidBills.length;
    // If any bills are currently overdue, streak is broken
    if (billsByStatus.overdue.length > 0) streak = 0;

    return streak;
  }, [bills, billsByStatus.overdue.length]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const bill: Bill = {
      id: editingBill?.id || `bill-${Date.now()}`,
      name: formData.name,
      amount: parseFloat(formData.amount),
      dueDate: formData.dueDate,
      categoryId: formData.categoryId,
      accountId: formData.accountId || undefined,
      isRecurring: formData.isRecurring,
      frequency: formData.isRecurring ? formData.frequency : undefined,
      status: BillStatus.UPCOMING,
      notes: formData.notes || undefined,
      lastPaidDate: editingBill?.lastPaidDate
    };

    if (editingBill) {
      onEditBill(bill);
      onAddNotification(NotificationType.SUCCESS, 'Bill Updated', `Updated ${bill.name}`);
    } else {
      onAddBill(bill);
      onAddNotification(NotificationType.SUCCESS, 'Bill Added', `Added ${bill.name} - due ${new Date(bill.dueDate).toLocaleDateString()}`);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      amount: '',
      dueDate: '',
      categoryId: categories[0]?.id || '',
      accountId: accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
      isRecurring: false,
      frequency: RecurringFrequency.MONTHLY,
      notes: ''
    });
    setEditingBill(null);
    setShowForm(false);
  };

  const handleEdit = (bill: Bill) => {
    setEditingBill(bill);
    setFormData({
      name: bill.name,
      amount: bill.amount.toString(),
      dueDate: bill.dueDate,
      categoryId: bill.categoryId,
      accountId: bill.accountId || accounts.find(a => a.isDefault)?.id || accounts[0]?.id || '',
      isRecurring: bill.isRecurring,
      frequency: bill.frequency || RecurringFrequency.MONTHLY,
      notes: bill.notes || ''
    });
    setShowForm(true);
  };

  const handleDelete = (bill: Bill) => {
    if (confirm(`Delete bill "${bill.name}"?`)) {
      onDeleteBill(bill.id);
      onAddNotification(NotificationType.INFO, 'Bill Deleted', `Deleted ${bill.name}`);
    }
  };

  const handleMarkAsPaid = (bill: Bill) => {
    // Create a transaction for the payment
    const transaction: Transaction = {
      id: `txn-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: `Bill Payment: ${bill.name}`,
      amount: bill.amount,
      categoryId: bill.categoryId,
      typeId: 'type-expense',
      isRecurring: false
    };

    onPayBill(bill, transaction.id);
    onAddNotification(NotificationType.SUCCESS, 'Bill Paid', `Marked ${bill.name} as paid`);
  };

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Unknown';
  };

  const getStatusColor = (status: BillStatus) => {
    switch (status) {
      case BillStatus.OVERDUE: return 'bg-red-100 text-red-800 border-red-300';
      case BillStatus.DUE_SOON: return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case BillStatus.PAID: return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-blue-100 text-blue-800 border-blue-300';
    }
  };

  const getStatusIcon = (status: BillStatus) => {
    switch (status) {
      case BillStatus.OVERDUE: return <AlertTriangle className="w-4 h-4" />;
      case BillStatus.DUE_SOON: return <Bell className="w-4 h-4" />;
      case BillStatus.PAID: return <Check className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const renderBillCard = (bill: Bill) => {
    const status = getBillStatus(bill);
    const category = categories.find(c => c.id === bill.categoryId);
    const account = accounts.find(a => a.id === bill.accountId);
    const daysUntilDue = Math.ceil((new Date(bill.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));

    return (
      <div
        key={bill.id}
        className={`rounded-xl p-4 border-2 ${getStatusColor(status)} hover:shadow-lg transition-all`}
        style={{ backgroundColor: 'var(--color-bg-card)' }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{category?.icon || '📄'}</span>
              <h3 className="font-bold text-lg" style={{ color: 'var(--color-text-primary)' }}>{bill.name}</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--color-text-tertiary)' }}>{getCategoryName(bill.categoryId)}</p>
            {account && (
              <p className="text-xs flex items-center gap-1 mt-1" style={{ color: 'var(--color-text-tertiary)' }}>
                <span>{account.icon}</span>
                <span>{account.name}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon(status)}
            <span className="font-bold text-xl" style={{ color: 'var(--color-text-primary)' }}>{currency}{bill.amount.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--color-text-tertiary)' }} />
            <span className="font-medium" style={{ color: 'var(--color-text-primary)' }}>
              {new Date(bill.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          {status !== BillStatus.PAID && (
            <span className={`font-medium ${daysUntilDue < 0 ? 'text-red-600' : daysUntilDue <= 3 ? 'text-yellow-600' : 'text-blue-600'}`}>
              {daysUntilDue < 0 ? `${Math.abs(daysUntilDue)} days overdue` : daysUntilDue === 0 ? 'Due today' : `${daysUntilDue} days`}
            </span>
          )}
        </div>

        {bill.isRecurring && (
          <div className="text-xs mb-3 flex items-center gap-1" style={{ color: 'var(--color-text-tertiary)' }}>
            <Bell className="w-3 h-3" />
            <span>Recurring {bill.frequency}</span>
          </div>
        )}

        {bill.notes && (
          <p className="text-sm mb-3 italic" style={{ color: 'var(--color-text-tertiary)' }}>{bill.notes}</p>
        )}

        {bill.linkedSubscriptionId && (
          <div className="text-xs mb-3 flex items-center gap-1 text-indigo-600">
            <Zap className="w-3 h-3" />
            <span>From subscription</span>
          </div>
        )}

        <div className="flex gap-2">
          {status !== BillStatus.PAID && (
            <button
              onClick={() => handleMarkAsPaid(bill)}
              className="flex-1 bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
            >
              <Check className="w-4 h-4" />
              Mark Paid
            </button>
          )}
          <button
            onClick={() => handleEdit(bill)}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(bill)}
            className="text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
            style={{ backgroundColor: 'var(--color-text-tertiary)' }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-primary)' }}>BILL TRACKER</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-tertiary)' }}>Never miss a payment</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Plus className="w-5 h-5" />
          Add Bill
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600 font-medium uppercase">Overdue</p>
              <p className="text-2xl font-bold text-red-700">{billsByStatus.overdue.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500" />
          </div>
        </div>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-600 font-medium uppercase">Due Soon</p>
              <p className="text-2xl font-bold text-yellow-700">{billsByStatus.dueSoon.length}</p>
            </div>
            <Bell className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600 font-medium uppercase">Upcoming</p>
              <p className="text-2xl font-bold text-blue-700">{billsByStatus.upcoming.length}</p>
            </div>
            <Calendar className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600 font-medium uppercase">Paid</p>
              <p className="text-2xl font-bold text-green-700">{billsByStatus.paid.length}</p>
            </div>
            <Check className="w-8 h-8 text-green-500" />
          </div>
        </div>
        <div className={`rounded-xl p-4 border-2 col-span-2 md:col-span-1 ${paymentStreak > 0 ? 'bg-purple-50 border-purple-200' : ''}`}
          style={paymentStreak <= 0 ? { backgroundColor: 'var(--color-bg-tertiary)', borderColor: 'var(--color-border-card)' } : undefined}>
          <div className="flex items-center justify-between">
            <div>
              <p className={`text-sm font-medium uppercase ${paymentStreak > 0 ? 'text-purple-600' : ''}`} style={paymentStreak <= 0 ? { color: 'var(--color-text-tertiary)' } : undefined}>Streak</p>
              <p className={`text-2xl font-bold ${paymentStreak > 0 ? 'text-purple-700' : ''}`} style={paymentStreak <= 0 ? { color: 'var(--color-text-tertiary)' } : undefined}>{paymentStreak}</p>
            </div>
            <span className="text-2xl">{paymentStreak >= 10 ? '🔥' : paymentStreak > 0 ? '⚡' : '💤'}</span>
          </div>
        </div>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="rounded-2xl p-6 shadow-lg" style={{ backgroundColor: 'var(--color-bg-card)', border: '2px solid var(--color-border-card)' }}>
          <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--color-text-primary)' }}>{editingBill ? 'Edit Bill' : 'Add New Bill'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Bill Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  placeholder="Electric Bill"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  placeholder="150.00"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Due Date</label>
                <input
                  type="date"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Category</label>
                <select
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Account</label>
                <select
                  value={formData.accountId}
                  onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.icon} {acc.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isRecurring}
                  onChange={(e) => setFormData({ ...formData, isRecurring: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>Recurring Bill</span>
              </label>
              {formData.isRecurring && (
                <select
                  value={formData.frequency}
                  onChange={(e) => setFormData({ ...formData, frequency: e.target.value as RecurringFrequency })}
                  className="px-3 py-1 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                >
                  {Object.values(RecurringFrequency).map(freq => (
                    <option key={freq} value={freq}>{freq}</option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1" style={{ color: 'var(--color-text-secondary)' }}>Notes (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-card)' }}
                rows={2}
                placeholder="Additional details..."
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingBill ? 'Update Bill' : 'Add Bill'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 rounded-lg transition-colors font-medium"
                style={{ border: '2px solid var(--color-border-card)', color: 'var(--color-text-primary)', backgroundColor: 'var(--color-bg-card)' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Bills List */}
      {billsByStatus.overdue.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-red-600 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            OVERDUE BILLS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {billsByStatus.overdue.map(renderBillCard)}
          </div>
        </div>
      )}

      {billsByStatus.dueSoon.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-yellow-600 mb-3 flex items-center gap-2">
            <Bell className="w-5 h-5" />
            DUE SOON (Next 3 Days)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {billsByStatus.dueSoon.map(renderBillCard)}
          </div>
        </div>
      )}

      {billsByStatus.upcoming.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            UPCOMING BILLS
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {billsByStatus.upcoming.map(renderBillCard)}
          </div>
        </div>
      )}

      {billsByStatus.paid.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center gap-2">
            <Check className="w-5 h-5" />
            PAID THIS MONTH
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {billsByStatus.paid.map(renderBillCard)}
          </div>
        </div>
      )}

      {bills.length === 0 && (
        <div className="text-center py-12 rounded-2xl" style={{ backgroundColor: 'var(--color-bg-card)' }}>
          <Calendar className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-text-tertiary)' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>No Bills Yet</h3>
          <p className="mb-4" style={{ color: 'var(--color-text-tertiary)' }}>Add your first bill to start tracking payments</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Add Your First Bill
          </button>
        </div>
      )}
    </div>
  );
}
