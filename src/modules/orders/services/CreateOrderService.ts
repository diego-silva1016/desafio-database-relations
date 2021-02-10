import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    if (!products) throw new AppError('Products obrigatorio.');

    const productsIds = products.map(product => ({
      id: product.id,
    }));

    const productsComplete = await this.productsRepository.findAllById(
      productsIds,
    );

    if (products.length !== productsComplete.length)
      throw new AppError('Nem todos os produtos passados existem.');

    const productsFormated = productsComplete.map(product => {
      const orderProduct = products.find(prod => prod.id === product.id);

      if (orderProduct && product.quantity - orderProduct.quantity >= 0)
        return {
          product_id: product.id,
          price: product.price,
          quantity: orderProduct.quantity,
        };
      throw new AppError('Produto não possui quantidade suficiente.');
    });

    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) throw new AppError('Customer não existe');

    const order = this.ordersRepository.create({
      customer,
      products: productsFormated,
    });

    const orderProductsQuantity = products.map(product => ({
      id: product.id,
      quantity:
        productsComplete.filter(item => item.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
