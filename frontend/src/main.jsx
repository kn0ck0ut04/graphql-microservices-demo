import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ApolloClient, HttpLink, InMemoryCache, gql } from '@apollo/client';
import { ApolloProvider, useMutation, useQuery } from '@apollo/client/react';
import './style.css';

const client = new ApolloClient({ link: new HttpLink({ uri: import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql' }), cache: new InMemoryCache() });
const DATA = gql`query Dashboard { users { id name email } products { id name price stock } orders { id quantity status user { id name email } product { id name price stock } } }`;
const MUTATIONS = {
  user: { create: gql`mutation($name:String!,$email:String!){createUser(name:$name,email:$email){id}}`, update: gql`mutation($id:ID!,$name:String!,$email:String!){updateUser(id:$id,name:$name,email:$email){id}}`, delete: gql`mutation($id:ID!){deleteUser(id:$id)}` },
  product: { create: gql`mutation($name:String!,$price:Float!,$stock:Int!){createProduct(name:$name,price:$price,stock:$stock){id}}`, update: gql`mutation($id:ID!,$name:String!,$price:Float!,$stock:Int!){updateProduct(id:$id,name:$name,price:$price,stock:$stock){id}}`, delete: gql`mutation($id:ID!){deleteProduct(id:$id)}` },
  order: { create: gql`mutation($userId:ID!,$productId:ID!,$quantity:Int!){createOrder(userId:$userId,productId:$productId,quantity:$quantity){id}}`, update: gql`mutation($id:ID!,$quantity:Int!,$status:String!){updateOrder(id:$id,quantity:$quantity,status:$status){id}}`, delete: gql`mutation($id:ID!){deleteOrder(id:$id)}` }
};
const EMPTY = { user: { name: '', email: '' }, product: { name: '', price: '', stock: '' }, order: { userId: '', productId: '', quantity: '' } };
const labels = { user: 'Пользователи', product: 'Товары', order: 'Заказы' };

function App() {
  const { data, loading, error, refetch } = useQuery(DATA, { notifyOnNetworkStatusChange: true });
  const [active, setActive] = useState('user');
  const [form, setForm] = useState(EMPTY.user);
  const [editing, setEditing] = useState(null);
  const [notice, setNotice] = useState('');
  const [save, { loading: saving }] = useMutation(MUTATIONS[active].create);
  const [update] = useMutation(MUTATIONS[active].update);
  const [remove] = useMutation(MUTATIONS[active].delete);
  const list = data ? data[`${active === 'user' ? 'users' : active === 'product' ? 'products' : 'orders'}`] : [];
  const setTab = (tab) => { setActive(tab); setForm(EMPTY[tab]); setEditing(null); setNotice(''); };
  const startEdit = (row) => {
    setEditing(row.id);
    setForm(active === 'user' ? { name: row.name, email: row.email } : active === 'product' ? { name: row.name, price: row.price, stock: row.stock } : { userId: row.user.id, productId: row.product.id, quantity: row.quantity, status: row.status });
    setNotice('');
  };
  const submit = async (event) => {
    event.preventDefault(); setNotice('');
    const variables = active === 'user' ? { ...form } : active === 'product' ? { ...form, price: Number(form.price), stock: Number(form.stock) } : { ...form, quantity: Number(form.quantity) };
    try {
      if (editing) await update({ variables: { id: editing, ...variables } });
      else await save({ variables });
      setForm(EMPTY[active]); setEditing(null); await refetch(); setNotice(editing ? 'Изменения сохранены' : 'Запись создана');
    } catch (e) { setNotice(e.message); }
  };
  const deleteRow = async (row) => {
    if (!window.confirm(`Удалить запись «${active === 'user' ? row.name : active === 'product' ? row.name : `Заказ №${row.id}`}»?`)) return;
    try { await remove({ variables: { id: row.id } }); await refetch(); setNotice('Запись удалена'); if (editing === row.id) { setEditing(null); setForm(EMPTY[active]); } }
    catch (e) { setNotice(e.message); }
  };
  const fields = active === 'user'
    ? [['name', 'Имя', 'text', 'Иван Иванов'], ['email', 'Электронная почта', 'email', 'ivan@example.test']]
    : active === 'product'
      ? [['name', 'Название', 'text', 'Клавиатура'], ['price', 'Цена, ₽', 'number', '4500'], ['stock', 'На складе', 'number', '10']]
      : editing
        ? [['quantity', 'Количество', 'number', '1'], ['status', 'Статус', 'text', 'NEW']]
        : [['userId', 'ID пользователя', 'number', '1'], ['productId', 'ID товара', 'number', '1'], ['quantity', 'Количество', 'number', '1']];
  return <main className="shell">
    <header className="topbar"><h1>Управление магазином</h1></header>
    <nav className="tabs" aria-label="Разделы данных">{Object.entries(labels).map(([key, label]) => <button key={key} className={active === key ? 'tab active' : 'tab'} onClick={() => setTab(key)} aria-current={active === key ? 'page' : undefined}>{label}<span>{data?.[key === 'user' ? 'users' : key === 'product' ? 'products' : 'orders'].length ?? 0}</span></button>)}</nav>
    <section className="workspace">
      <div className="list-panel"><div className="section-heading"><h2>{labels[active]}</h2><button className="refresh" onClick={() => refetch()} aria-label="Обновить список">↻</button></div>
        {loading && !data ? <p className="state">Загружаем данные…</p> : error ? <p className="state error">Ошибка API: {error.message}</p> : !list?.length ? <p className="state">Записей пока нет.</p> : <div className="table-wrap"><table><thead><tr>{(active === 'user' ? ['Имя', 'Email'] : active === 'product' ? ['Товар', 'Цена', 'Остаток'] : ['Заказ', 'Покупатель', 'Товар', 'Кол-во', 'Статус']).map(x => <th key={x}>{x}</th>)}<th><span className="sr-only">Действия</span></th></tr></thead><tbody>{list.map(row => <tr key={row.id}>
          {active === 'user' && <><td data-label="Имя"><strong>{row.name}</strong></td><td data-label="Email">{row.email}</td></>}
          {active === 'product' && <><td data-label="Товар"><strong>{row.name}</strong></td><td data-label="Цена">{row.price.toLocaleString('ru-RU')} ₽</td><td data-label="Остаток">{row.stock} шт.</td></>}
          {active === 'order' && <><td data-label="Заказ"><strong>№{row.id}</strong></td><td data-label="Покупатель">{row.user.name}</td><td data-label="Товар">{row.product.name}</td><td data-label="Кол-во">{row.quantity}</td><td data-label="Статус"><span className="status">{row.status}</span></td></>}
          <td className="actions"><button onClick={() => startEdit(row)} aria-label={`Изменить ${labels[active]}: ${row.name || `заказ ${row.id}`}`}>Изменить</button><button className="delete" onClick={() => deleteRow(row)} aria-label={`Удалить ${labels[active]}: ${row.name || `заказ ${row.id}`}`}>Удалить</button></td>
        </tr>)}</tbody></table></div>}
      </div>
      <aside className="form-panel"><h2>{editing ? 'Редактирование' : 'Новая запись'}</h2>
        <form onSubmit={submit} key={`${active}-${editing || 'new'}`}>
          {fields.map(([name, label, type, placeholder]) => <label className="field" key={name}>{label}<input name={name} type={type} placeholder={placeholder} required min={type === 'number' ? name === 'price' ? '0' : '1' : undefined} step={name === 'price' ? '0.01' : undefined} value={form[name] ?? ''} onChange={e => setForm({ ...form, [name]: e.target.value })} autoComplete={name === 'email' ? 'email' : name === 'name' ? 'name' : undefined}/></label>)}
          {active === 'order' && !editing && <p className="hint">Для создания заказа сначала добавьте пользователя и товар.</p>}
          <button className="submit" type="submit" disabled={saving}>{saving ? 'Сохраняем…' : editing ? 'Сохранить' : 'Создать'}</button>
          {editing && <button className="cancel" type="button" onClick={() => { setEditing(null); setForm(EMPTY[active]); }}>Отмена</button>}
        </form>
        {notice && <p className={notice.startsWith('Error') || notice.startsWith('Запись не') ? 'notice error' : 'notice'} role="status" aria-live="polite">{notice}</p>}
      </aside>
    </section>
  </main>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><ApolloProvider client={client}><App /></ApolloProvider></React.StrictMode>);
