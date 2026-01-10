import React, { useState, useMemo } from 'react';
import { Goal, GoalType, GoalStatus, GoalMilestone, Category, NotificationType, Transaction, TransactionBehavior, UserPreferences } from '../types';
import { Target, TrendingUp, DollarSign, Calendar, Award, Zap, Edit2, Trash2, Play, Pause, CheckCircle } from 'lucide-react';

interface GoalsProps {
  goals: Goal[];
  categories: Category[];
  transactions: Transaction[];
  preferences: UserPreferences;
  currency: string;
  onAddGoal: (goal: Goal) => void;
  onEditGoal: (goal: Goal) => void;
  onDeleteGoal: (goalId: string) => void;
  onUpdateGoalProgress: (goalId: string, amount: number) => void;
  onAddNotification: (type: NotificationType, title: string, message: string) => void;
}

export default function Goals({
  goals,
  categories,
  transactions,
  preferences,
  currency,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
  onUpdateGoalProgress,
  onAddNotification
}: GoalsProps) {
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [showProgressModal, setShowProgressModal] = useState<Goal | null>(null);
  const [progressAmount, setProgressAmount] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: GoalType.SAVINGS,
    targetAmount: '',
    currentAmount: '0',
    deadline: '',
    categoryId: '',
    monthlyContribution: '',
    icon: '🎯',
    color: '#3b82f6'
  });

  const defaultMilestones: GoalMilestone[] = [
    { percentage: 25, label: '25% Complete', achieved: false },
    { percentage: 50, label: 'Halfway There!', achieved: false },
    { percentage: 75, label: '75% Complete', achieved: false },
    { percentage: 100, label: 'Goal Achieved!', achieved: false }
  ];

  // Calculate statistics
  const stats = useMemo(() => {
    const active = goals.filter(g => g.status === GoalStatus.IN_PROGRESS);
    const completed = goals.filter(g => g.status === GoalStatus.COMPLETED);
    const totalTarget = active.reduce((sum, g) => sum + g.targetAmount, 0);
    const totalProgress = active.reduce((sum, g) => sum + g.currentAmount, 0);
    const totalRemaining = totalTarget - totalProgress;

    return {
      activeCount: active.length,
      completedCount: completed.length,
      totalTarget,
      totalProgress,
      totalRemaining,
      percentComplete: totalTarget > 0 ? (totalProgress / totalTarget) * 100 : 0
    };
  }, [goals]);

  // Calculate projected completion date
  const calculateProjection = (goal: Goal): string | null => {
    if (!goal.monthlyContribution || goal.monthlyContribution <= 0) return null;
    const remaining = goal.targetAmount - goal.currentAmount;
    const monthsRemaining = Math.ceil(remaining / goal.monthlyContribution);
    const projectedDate = new Date();
    projectedDate.setMonth(projectedDate.getMonth() + monthsRemaining);
    return projectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const targetAmount = parseFloat(formData.targetAmount);
    const currentAmount = parseFloat(formData.currentAmount);

    // Create milestones based on current progress
    const milestones = defaultMilestones.map(m => ({
      ...m,
      achieved: (currentAmount / targetAmount) * 100 >= m.percentage,
      achievedDate: (currentAmount / targetAmount) * 100 >= m.percentage
        ? new Date().toISOString()
        : undefined
    }));

    const goal: Goal = {
      id: editingGoal?.id || `goal-${Date.now()}`,
      name: formData.name,
      description: formData.description || undefined,
      type: formData.type,
      targetAmount,
      currentAmount,
      deadline: formData.deadline || undefined,
      status: currentAmount >= targetAmount ? GoalStatus.COMPLETED : GoalStatus.IN_PROGRESS,
      categoryId: formData.categoryId || undefined,
      monthlyContribution: formData.monthlyContribution ? parseFloat(formData.monthlyContribution) : undefined,
      icon: formData.icon,
      color: formData.color,
      milestones: editingGoal?.milestones || milestones,
      createdDate: editingGoal?.createdDate || new Date().toISOString()
    };

    if (editingGoal) {
      onEditGoal(goal);
      onAddNotification(NotificationType.SUCCESS, 'Goal Updated', `Updated ${goal.name}`);
    } else {
      onAddGoal(goal);
      onAddNotification(NotificationType.SUCCESS, 'Goal Created', `Created goal: ${goal.name}`);
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      type: GoalType.SAVINGS,
      targetAmount: '',
      currentAmount: '0',
      deadline: '',
      categoryId: '',
      monthlyContribution: '',
      icon: '🎯',
      color: '#3b82f6'
    });
    setEditingGoal(null);
    setShowForm(false);
  };

  const handleEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormData({
      name: goal.name,
      description: goal.description || '',
      type: goal.type,
      targetAmount: goal.targetAmount.toString(),
      currentAmount: goal.currentAmount.toString(),
      deadline: goal.deadline || '',
      categoryId: goal.categoryId || '',
      monthlyContribution: goal.monthlyContribution?.toString() || '',
      icon: goal.icon || '🎯',
      color: goal.color || '#3b82f6'
    });
    setShowForm(true);
  };

  const handleDelete = (goal: Goal) => {
    if (confirm(`Delete goal "${goal.name}"?`)) {
      onDeleteGoal(goal.id);
      onAddNotification(NotificationType.INFO, 'Goal Deleted', `Deleted ${goal.name}`);
    }
  };

  const handleUpdateProgress = () => {
    if (!showProgressModal || !progressAmount) return;

    const amount = parseFloat(progressAmount);
    onUpdateGoalProgress(showProgressModal.id, amount);
    onAddNotification(NotificationType.SUCCESS, 'Progress Updated', `Added ${currency}${amount} to ${showProgressModal.name}`);

    setShowProgressModal(null);
    setProgressAmount('');
  };

  const getTypeIcon = (type: GoalType) => {
    switch (type) {
      case GoalType.SAVINGS: return '🏦';
      case GoalType.DEBT_PAYOFF: return '💳';
      case GoalType.PURCHASE: return '🛍️';
      case GoalType.INVESTMENT: return '📈';
    }
  };

  const getTypeColor = (type: GoalType) => {
    switch (type) {
      case GoalType.SAVINGS: return 'text-green-600';
      case GoalType.DEBT_PAYOFF: return 'text-red-600';
      case GoalType.PURCHASE: return 'text-purple-600';
      case GoalType.INVESTMENT: return 'text-blue-600';
    }
  };

  const renderGoalCard = (goal: Goal) => {
    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    const remaining = goal.targetAmount - goal.currentAmount;
    const projection = calculateProjection(goal);
    const nextMilestone = goal.milestones.find(m => !m.achieved);
    const isOverdue = goal.deadline && new Date(goal.deadline) < new Date() && goal.status !== GoalStatus.COMPLETED;

    return (
      <div
        key={goal.id}
        className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200 hover:shadow-xl transition-all"
        style={{ borderLeftWidth: '8px', borderLeftColor: goal.color }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="text-4xl">{goal.icon}</div>
            <div>
              <h3 className="font-bold text-xl">{goal.name}</h3>
              <p className="text-sm text-gray-600">{goal.description}</p>
            </div>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${getTypeColor(goal.type)} bg-opacity-10`}>
            {goal.type}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium">{currency}{goal.currentAmount.toFixed(2)}</span>
            <span className="font-bold text-lg">{progress.toFixed(1)}%</span>
            <span className="font-medium text-gray-600">{currency}{goal.targetAmount.toFixed(2)}</span>
          </div>
          <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(progress, 100)}%`,
                background: `linear-gradient(to right, ${goal.color}, ${goal.color}dd)`
              }}
            />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {currency}{remaining.toFixed(2)} remaining
          </p>
        </div>

        {/* Milestones */}
        <div className="flex gap-2 mb-4">
          {goal.milestones.map((milestone, idx) => (
            <div
              key={idx}
              className={`flex-1 text-center p-2 rounded-lg text-xs ${
                milestone.achieved
                  ? 'bg-green-100 text-green-800 border-2 border-green-300'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {milestone.achieved && <CheckCircle className="w-4 h-4 mx-auto mb-1" />}
              <span className="font-bold">{milestone.percentage}%</span>
            </div>
          ))}
        </div>

        {/* Info Row */}
        <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
          {goal.deadline && (
            <div className={`flex items-center gap-2 ${isOverdue ? 'text-red-600' : 'text-gray-600'}`}>
              <Calendar className="w-4 h-4" />
              <span className="font-medium">
                {isOverdue ? 'Overdue: ' : 'Due: '}
                {new Date(goal.deadline).toLocaleDateString()}
              </span>
            </div>
          )}
          {projection && (
            <div className="flex items-center gap-2 text-blue-600">
              <TrendingUp className="w-4 h-4" />
              <span className="font-medium">Est: {projection}</span>
            </div>
          )}
          {goal.monthlyContribution && (
            <div className="flex items-center gap-2 text-green-600">
              <DollarSign className="w-4 h-4" />
              <span className="font-medium">{currency}{goal.monthlyContribution}/month</span>
            </div>
          )}
          {nextMilestone && (
            <div className="flex items-center gap-2 text-purple-600">
              <Award className="w-4 h-4" />
              <span className="font-medium">Next: {nextMilestone.percentage}%</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {goal.status === GoalStatus.IN_PROGRESS && (
            <button
              onClick={() => setShowProgressModal(goal)}
              className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Add Progress
            </button>
          )}
          <button
            onClick={() => handleEdit(goal)}
            className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDelete(goal)}
            className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const activeGoals = goals.filter(g => g.status === GoalStatus.IN_PROGRESS);
  const completedGoals = goals.filter(g => g.status === GoalStatus.COMPLETED);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900 uppercase tracking-wide">FINANCIAL GOALS</h2>
          <p className="text-sm text-gray-600 mt-1">Track your progress toward financial milestones</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 font-medium"
        >
          <Target className="w-5 h-5" />
          Create Goal
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-100 uppercase">Active Goals</p>
              <p className="text-3xl font-bold">{stats.activeCount}</p>
            </div>
            <Target className="w-8 h-8 text-blue-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-600 to-emerald-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-100 uppercase">Total Progress</p>
              <p className="text-3xl font-bold">{currency}{stats.totalProgress.toFixed(0)}</p>
            </div>
            <DollarSign className="w-8 h-8 text-green-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-600 to-pink-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-purple-100 uppercase">Remaining</p>
              <p className="text-3xl font-bold">{currency}{stats.totalRemaining.toFixed(0)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-200" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-600 to-red-700 text-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-100 uppercase">Completed</p>
              <p className="text-3xl font-bold">{stats.completedCount}</p>
            </div>
            <Award className="w-8 h-8 text-orange-200" />
          </div>
        </div>
      </div>

      {/* Overall Progress */}
      {stats.activeCount > 0 && (
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-2xl p-6">
          <h3 className="font-bold text-lg mb-3">Overall Progress</h3>
          <div className="flex items-center gap-4 mb-2">
            <div className="flex-1 h-6 bg-white bg-opacity-20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-500"
                style={{ width: `${Math.min(stats.percentComplete, 100)}%` }}
              />
            </div>
            <span className="font-bold text-2xl">{stats.percentComplete.toFixed(1)}%</span>
          </div>
          <p className="text-sm text-indigo-100">
            {currency}{stats.totalProgress.toFixed(2)} of {currency}{stats.totalTarget.toFixed(2)}
          </p>
        </div>
      )}

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-white rounded-2xl p-6 shadow-lg border-2 border-gray-200">
          <h3 className="text-xl font-bold mb-4">{editingGoal ? 'Edit Goal' : 'Create New Goal'}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Emergency Fund, Vacation, etc."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Goal Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as GoalType })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {Object.values(GoalType).map(type => (
                    <option key={type} value={type}>{getTypeIcon(type)} {type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.targetAmount}
                  onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5000"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Current Amount</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.currentAmount}
                  onChange={(e) => setFormData({ ...formData, currentAmount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Deadline (Optional)</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Contribution (Optional)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.monthlyContribution}
                  onChange={(e) => setFormData({ ...formData, monthlyContribution: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
                <input
                  type="text"
                  value={formData.icon}
                  onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="🎯"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full h-10 px-1 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={2}
                placeholder="What is this goal for?"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {editingGoal ? 'Update Goal' : 'Create Goal'}
              </button>
              <button
                type="button"
                onClick={resetForm}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-blue-600 mb-3 flex items-center gap-2">
            <Target className="w-5 h-5" />
            IN PROGRESS
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeGoals.map(renderGoalCard)}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-green-600 mb-3 flex items-center gap-2">
            <Award className="w-5 h-5" />
            COMPLETED
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-75">
            {completedGoals.map(renderGoalCard)}
          </div>
        </div>
      )}

      {/* Empty State */}
      {goals.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl">
          <Target className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Goals Yet</h3>
          <p className="text-gray-600 mb-4">Set your first financial goal and start tracking progress</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Create Your First Goal
          </button>
        </div>
      )}

      {/* Progress Update Modal */}
      {showProgressModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold mb-4">Update Progress: {showProgressModal.name}</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add Amount</label>
              <input
                type="number"
                step="0.01"
                value={progressAmount}
                onChange={(e) => setProgressAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="100.00"
                autoFocus
              />
              <p className="text-sm text-gray-600 mt-1">
                Current: {currency}{showProgressModal.currentAmount.toFixed(2)} / {currency}{showProgressModal.targetAmount.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleUpdateProgress}
                className="flex-1 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                Add Progress
              </button>
              <button
                onClick={() => {
                  setShowProgressModal(null);
                  setProgressAmount('');
                }}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
