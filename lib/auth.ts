import Cookies from 'js-cookie';

// Метод для удаления куки при выходе
export const logoutUser = () => {
  Cookies.remove('voyage_token');
};

// Метод для проверки, авторизован ли пользователь (нужен для middleware)
export const isAuthenticated = () => {
  return !!Cookies.get('voyage_token');
};